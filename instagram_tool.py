from apify_client import ApifyClient
from crewai.tools import BaseTool
from dotenv import load_dotenv
from typing import Type
from pydantic import BaseModel, Field
import os
import json

load_dotenv()


# INPUT SCHEMAS

class ProfileInput(BaseModel):
    usernames: str = Field(
        description="Comma-separated Instagram usernames to scrape. E.g. 'yogabar, saffola, trueelements'"
    )
    posts_per_account: int = Field(
        default=30,
        description="How many recent posts to pull per account"
    )


class HashtagInput(BaseModel):
    hashtags: str = Field(
        description="Comma-separated hashtags to research (without #). E.g. 'healthysnacks, indianfood, cleaneating'"
    )
    posts_per_hashtag: int = Field(
        default=20,
        description="How many posts to pull per hashtag"
    )


# HELPER: format post data cleanly for the agent

def format_posts(posts, source):
    if not posts:
        return f"No posts found for {source}."

    lines = [f"\n== {source.upper()} ({len(posts)} posts) ==\n"]
    for i, post in enumerate(posts[:30], 1):
        likes      = post.get("likesCount", 0) or 0
        comments   = post.get("commentsCount", 0) or 0
        caption    = (post.get("caption") or "")[:200].replace("\n", " ")
        post_type  = post.get("type", "unknown")
        timestamp  = (post.get("timestamp") or "")[:10]
        hashtags   = post.get("hashtags") or []
        hashtag_str= ", ".join(f"#{h}" for h in hashtags[:10])

        lines.append(
            f"Post {i} | {post_type} | {timestamp}\n"
            f"  Likes: {likes:,}  Comments: {comments:,}  "
            f"Engagement: {likes + comments:,}\n"
            f"  Caption: {caption}\n"
            f"  Hashtags: {hashtag_str}\n"
        )

    # Summary stats
    all_likes    = [p.get("likesCount", 0) or 0 for p in posts]
    all_comments = [p.get("commentsCount", 0) or 0 for p in posts]
    types        = [p.get("type", "unknown") for p in posts]
    type_counts  = {t: types.count(t) for t in set(types)}

    lines.append(f"\n-- SUMMARY for {source} --")
    lines.append(f"Avg likes: {int(sum(all_likes)/len(all_likes)):,}")
    lines.append(f"Avg comments: {int(sum(all_comments)/len(all_comments)):,}")
    lines.append(f"Top post: {max(all_likes):,} likes")
    lines.append(f"Format breakdown: {type_counts}")
    lines.append("")

    return "\n".join(lines)


# TOOL 1: PROFILE SCRAPER

class InstagramProfileTool(BaseTool):
    name: str = "instagram_profile_scraper"
    description: str = (
        "Scrapes real Instagram profiles to get recent posts, engagement data, "
        "caption patterns, hashtags, and format breakdown. "
        "Use this to research competitor accounts. "
        "Input: comma-separated Instagram usernames."
    )
    args_schema: Type[BaseModel] = ProfileInput

    def _run(self, usernames: str, posts_per_account: int = 30) -> str:
        api_key = os.getenv("APIFY_API_KEY")
        if not api_key:
            return "APIFY_API_KEY not found in .env file."

        client    = ApifyClient(api_key)
        username_list = [u.strip().lstrip("@") for u in usernames.split(",") if u.strip()]

        if not username_list:
            return "No valid usernames provided."

        print(f"\n[Instagram] Scraping {len(username_list)} accounts: {', '.join(username_list)}")

        try:
            run = client.actor("apify/instagram-profile-scraper").call(
                run_input={
                    "usernames": username_list,
                    "resultsLimit": posts_per_account
                }
            )

            items = list(client.dataset(run["defaultDatasetId"]).iterate_items())

            if not items:
                return "No data returned. Check that the usernames are correct and public."

            output = ["INSTAGRAM PROFILE RESEARCH\n" + "="*50]
            for item in items:
                username   = item.get("username", "unknown")
                followers  = item.get("followersCount", 0) or 0
                following  = item.get("followingCount", 0) or 0
                bio        = (item.get("biography") or "")[:200]
                posts_count= item.get("postsCount", 0) or 0
                posts      = item.get("latestPosts") or []

                output.append(
                    f"\n@{username}\n"
                    f"Followers: {followers:,} | Following: {following:,} | Total posts: {posts_count:,}\n"
                    f"Bio: {bio}\n"
                )
                output.append(format_posts(posts, f"@{username}"))

            return "\n".join(output)

        except Exception as e:
            return f"Error scraping profiles: {str(e)}"


# TOOL 2: HASHTAG RESEARCHER

class InstagramHashtagTool(BaseTool):
    name: str = "instagram_hashtag_researcher"
    description: str = (
        "Researches Instagram hashtags to find top performing posts, "
        "caption styles, engagement patterns, and content trends in a niche. "
        "Use this to understand what content performs under relevant hashtags. "
        "Input: comma-separated hashtags without the # symbol."
    )
    args_schema: Type[BaseModel] = HashtagInput

    def _run(self, hashtags: str, posts_per_hashtag: int = 20) -> str:
        api_key = os.getenv("APIFY_API_KEY")
        if not api_key:
            return "APIFY_API_KEY not found in .env file."

        client       = ApifyClient(api_key)
        hashtag_list = [h.strip().lstrip("#") for h in hashtags.split(",") if h.strip()]

        if not hashtag_list:
            return "No valid hashtags provided."

        print(f"\n[Instagram] Researching hashtags: #{', #'.join(hashtag_list)}")

        try:
            run = client.actor("apify/instagram-hashtag-scraper").call(
                run_input={
                    "hashtags": hashtag_list,
                    "resultsLimit": posts_per_hashtag
                }
            )

            items = list(client.dataset(run["defaultDatasetId"]).iterate_items())

            if not items:
                return "No hashtag data returned."

            # Group by hashtag
            by_hashtag = {}
            for item in items:
                tag = item.get("hashtag") or "unknown"
                if tag not in by_hashtag:
                    by_hashtag[tag] = []
                by_hashtag[tag].append(item)

            output = ["INSTAGRAM HASHTAG RESEARCH\n" + "="*50]
            for tag, posts in by_hashtag.items():
                output.append(format_posts(posts, f"#{tag}"))

            # Cross-hashtag patterns
            all_captions = []
            all_tags     = []
            for item in items:
                cap = (item.get("caption") or "")[:300]
                if cap:
                    all_captions.append(cap)
                all_tags.extend(item.get("hashtags") or [])

            if all_tags:
                tag_freq = {}
                for t in all_tags:
                    tag_freq[t] = tag_freq.get(t, 0) + 1
                top_tags = sorted(tag_freq.items(), key=lambda x: x[1], reverse=True)[:20]
                output.append("\nTOP CO-OCCURRING HASHTAGS ACROSS ALL POSTS:")
                output.append(", ".join(f"#{t[0]}({t[1]})" for t in top_tags))

            return "\n".join(output)

        except Exception as e:
            return f"Error researching hashtags: {str(e)}"


# INSTANTIATE TOOLS FOR IMPORT

instagram_profile_tool  = InstagramProfileTool()
instagram_hashtag_tool  = InstagramHashtagTool()


# STANDALONE TEST

if __name__ == "__main__":
    print("Instagram Tool Test")
    print("1. Scrape profiles")
    print("2. Research hashtags")
    choice = input("Choose: ").strip()

    if choice == "1":
        usernames = input("Enter usernames (comma separated, no @): ")
        tool = InstagramProfileTool()
        result = tool._run(usernames=usernames)
        print(result)
        with open("instagram_profile_test.txt", "w", encoding="utf-8") as f:
            f.write(result)
        print("\nSaved to instagram_profile_test.txt")

    elif choice == "2":
        hashtags = input("Enter hashtags (comma separated, no #): ")
        tool = InstagramHashtagTool()
        result = tool._run(hashtags=hashtags)
        print(result)
        with open("instagram_hashtag_test.txt", "w", encoding="utf-8") as f:
            f.write(result)
        print("\nSaved to instagram_hashtag_test.txt")