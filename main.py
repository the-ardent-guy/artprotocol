import os
import sys
import json
import subprocess
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

#  IMPORT CREWS 
# Each crew is imported only when needed to keep startup fast

def import_branding():
    from branding_crew import run_branding_crew
    return run_branding_crew

def import_social():
    from social_crew import run_social_crew
    return run_social_crew

def import_ads():
    from ads_crew import run_ads_crew
    return run_ads_crew

def import_proposal():
    from proposal_crew import run_proposal_crew
    return run_proposal_crew

def import_research():
    # research.py exposes a `run()` entrypoint
    from research import run as run_research
    return run_research


#  CLIENT FOLDER 

def setup_client_folder(client_name):
    """Create a folder for this client and return the path"""
    safe_name = client_name.replace(" ", "_")
    folder    = os.path.join("clients", safe_name)
    os.makedirs(folder, exist_ok=True)
    return folder


def save_output(folder, filename, content):
    """Save any output to the client folder"""
    filepath = os.path.join(folder, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(str(content))
    print(f"  done: Saved -> {filepath}")
    return filepath


def load_existing_doc(folder):
    """Check if a brand document already exists for this client"""
    for fname in os.listdir(folder):
        if fname.endswith(".txt") and "brand" in fname.lower():
            filepath = os.path.join(folder, fname)
            with open(filepath, "r", encoding="utf-8") as f:
                return f.read()
    return None


#  SESSION STATE 

def load_session(folder):
    """Load existing session data for this client"""
    session_file = os.path.join(folder, "session.json")
    if os.path.exists(session_file):
        with open(session_file, "r") as f:
            return json.load(f)
    return {}


def save_session(folder, session):
    """Save session data for this client"""
    session_file = os.path.join(folder, "session.json")
    with open(session_file, "w") as f:
        json.dump(session, f, indent=2)


#  UI HELPERS 

def header(text):
    print("\n" + ""*55)
    print(f"  {text}")
    print(""*55)

def section(text):
    print(f"\n {text} " + ""*(50 - len(text)))

def ask(question, default=None):
    if default:
        answer = input(f"{question} [{default}]: ").strip()
        return answer if answer else default
    return input(f"{question}: ").strip()

def confirm(question):
    answer = input(f"{question} (y/n): ").strip().lower()
    return answer in ["y", "yes"]


#  RESEARCH PHASE 

def run_research_phase(client_name, folder, session):
    section("RESEARCH PHASE")

    # Check if research already done
    if session.get("research_done"):
        print(f"  Research already exists for {client_name}.")
        if not confirm("  Run fresh research?"):
            research_path = session.get("research_path")
            if research_path and os.path.exists(research_path):
                with open(research_path, "r", encoding="utf-8") as f:
                    return f.read()

    run_research = import_research()
    result       = run_research()
    timestamp    = datetime.now().strftime("%Y%m%d_%H%M")
    filename     = f"research_{timestamp}.txt"
    path         = save_output(folder, filename, result)

    session["research_done"] = True
    session["research_path"] = path

    return str(result)


#  BRAND DOCUMENT CHECK 

def get_brand_context(client_name, folder, session):
    """
    Returns brand context for crews that need it.
    Checks in order:
    1. Already loaded in session
    2. Existing file in client folder
    3. User provides a file path
    4. Skip (crews run with brief only)
    """
    section("BRAND CONTEXT")

    # Already in session
    if session.get("brand_doc"):
        print("  Using brand document from this session.")
        return session["brand_doc"]

    # Check folder for existing doc
    existing = load_existing_doc(folder)
    if existing:
        print(f"  Found existing brand document in {folder}/")
        if confirm("  Use this as context for all crews?"):
            session["brand_doc"] = existing
            return existing

    # User wants to provide one
    print("\n  Do you have an existing brand document or research for this client?")
    print("  1. Yes - I have a file")
    print("  2. Run research first")
    print("  3. Skip - crews will work from the brief only")

    choice = ask("  Choose").strip()

    if choice == "1":
        filepath = ask("  File path (drag file into terminal or type path)").strip().strip('"')
        if os.path.exists(filepath):
            with open(filepath, "r", encoding="utf-8") as f:
                doc = f.read()
            session["brand_doc"] = doc
            print("  done: Brand document loaded.")
            return doc
        else:
            print("  File not found. Continuing without brand document.")
            return None

    elif choice == "2":
        return run_research_phase(client_name, folder, session)

    else:
        print("  Continuing without brand document.")
        return None


#  RUN INDIVIDUAL CREW 

def run_branding(client_name, folder, session, brand_doc=None):
    section("BRANDING CREW")
    print("  10 agents: cultural research, competitor analysis, archetype,")
    print("  strategy, visual identity, positioning, GTM, SWOT, critic, compiler")
    print("  Estimated time: 15-20 minutes\n")

    run = import_branding()
    result = run()

    timestamp = datetime.now().strftime("%Y%m%d_%H%M")
    path = save_output(folder, f"brand_document_{timestamp}.txt", result)
    session["brand_done"] = True
    session["brand_path"] = path
    session["brand_doc"]  = str(result)
    return str(result)


def run_social(client_name, folder, session, brand_doc=None):
    section("SOCIAL MEDIA CREW")
    print("  8 agents: brand voice, platform intel, content strategy,")
    print("  campaigns, calendar, copy, QA, scheduler")
    print("  Estimated time: 15-20 minutes\n")

    run = import_social()
    result = run(brand_document=brand_doc)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M")
    path = save_output(folder, f"social_media_{timestamp}.txt", result)
    session["social_done"] = True
    session["social_path"] = path
    return str(result)


def run_ads(client_name, folder, session, brand_doc=None):
    section("ADS CREW")
    print("  8 agents: audience research, competitor ad intelligence,")
    print("  strategy, copy, creative direction, campaign architecture,")
    print("  performance framework, deployment")
    print("  Estimated time: 15-20 minutes\n")

    run = import_ads()
    result = run(brand_document=brand_doc)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M")
    path = save_output(folder, f"ads_campaign_{timestamp}.txt", result)
    session["ads_done"] = True
    session["ads_path"] = path
    return str(result)


def run_proposal(client_name, folder, session):
    section("PROPOSAL CREW")
    print("  4 agents: proposal writer, scope writer, pricing strategist, critic")
    print("  Then launches document generator -> Word docs ready to send")
    print("  Estimated time: 5-8 minutes\n")

    run = import_proposal()
    result = run()

    timestamp = datetime.now().strftime("%Y%m%d_%H%M")
    path = save_output(folder, f"proposal_brief_{timestamp}.txt", result)
    session["proposal_done"] = True
    session["proposal_path"] = path

    # Move generated Word docs to client folder if they exist
    for f in os.listdir("."):
        if f.startswith(client_name.replace(" ", "_")) and f.endswith(".docx"):
            dest = os.path.join(folder, f)
            os.rename(f, dest)
            print(f"  done: Moved {f} -> {dest}")

    return str(result)


#  MENU 

def show_menu(client_name, session):
    header(f"ART PROTOCOL - {client_name.upper()}")

    done = []
    if session.get("research_done"): done.append("research")
    if session.get("brand_done"):    done.append("branding")
    if session.get("social_done"):   done.append("social")
    if session.get("ads_done"):      done.append("ads")
    if session.get("proposal_done"): done.append("proposal")

    if done:
        print(f"  Completed: {', '.join(done)}")

    print("""
  What do you want to run?

  1.  Branding Crew
  2.  Social Media Crew
  3.  Ads Crew
  4.  Proposal Crew
  5.  Research only
  
  6.  Run ALL crews in sequence
  7.  Switch client
  8.  Exit
""")
    return ask("  Choose").strip()


#  FULL RUN 

def run_all(client_name, folder, session):
    header(f"FULL RUN - {client_name.upper()}")
    print("  Running: Research -> Branding -> Social -> Ads -> Proposal")
    print("  Estimated total time: 60-90 minutes\n")

    if not confirm("  Start full run?"):
        return

    brand_doc = get_brand_context(client_name, folder, session)
    brand_doc = run_branding(client_name, folder, session, brand_doc)
    run_social(client_name, folder, session, brand_doc)
    run_ads(client_name, folder, session, brand_doc)
    run_proposal(client_name, folder, session)

    header("FULL RUN COMPLETE")
    print(f"  All outputs saved to: clients/{client_name.replace(' ','_')}/")
    print(f"  Files generated:")
    for f in os.listdir(folder):
        print(f"    -> {f}")


#  CLIENT SETUP 

def setup_client():
    header("ART PROTOCOL - AI AGENCY")

    # List existing clients
    if os.path.exists("clients"):
        existing = [d for d in os.listdir("clients") if os.path.isdir(os.path.join("clients", d))]
        if existing:
            print("\n  Existing clients:")
            for i, name in enumerate(existing, 1):
                print(f"  {i}. {name.replace('_', ' ')}")
            print()

    client_name = ask("  Client name (new or existing)").strip()
    folder      = setup_client_folder(client_name)
    session     = load_session(folder)

    print(f"\n  done: Client folder: clients/{client_name.replace(' ','_')}/")
    return client_name, folder, session


#  MAIN LOOP 

def main():
    os.makedirs("clients", exist_ok=True)

    client_name, folder, session = setup_client()

    while True:
        choice = show_menu(client_name, session)

        try:
            if choice == "1":
                brand_doc = get_brand_context(client_name, folder, session)
                run_branding(client_name, folder, session, brand_doc)

            elif choice == "2":
                brand_doc = session.get("brand_doc") or get_brand_context(client_name, folder, session)
                run_social(client_name, folder, session, brand_doc)

            elif choice == "3":
                brand_doc = session.get("brand_doc") or get_brand_context(client_name, folder, session)
                run_ads(client_name, folder, session, brand_doc)

            elif choice == "4":
                run_proposal(client_name, folder, session)

            elif choice == "5":
                research = run_research_phase(client_name, folder, session)
                session["brand_doc"] = research

            elif choice == "6":
                run_all(client_name, folder, session)

            elif choice == "7":
                save_session(folder, session)
                client_name, folder, session = setup_client()

            elif choice == "8":
                save_session(folder, session)
                print("\n  Session saved. Goodbye.\n")
                sys.exit(0)

            else:
                print("  Invalid choice. Try again.")

        except KeyboardInterrupt:
            print("\n\n  Interrupted. Saving session...")
            save_session(folder, session)
            print("  Session saved.\n")
            sys.exit(0)

        except Exception as e:
            print(f"\n  Error: {e}")
            print("  Session saved. You can continue from where you left off.")
            save_session(folder, session)

        # Save session after every action
        save_session(folder, session)


if __name__ == "__main__":
    main()