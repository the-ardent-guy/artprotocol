"""Phase 1 smoke test — run from project root."""
import sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

print("=" * 50)
print("TEST 1: database.py — Brand DNA")
print("=" * 50)
import database as db

# Test get on nonexistent
r = db.get_brand_dna("nonexistent-proj")
assert r is None, f"Expected None, got {r}"
print("  [OK] get_brand_dna on nonexistent -> None")

# Test save + get
raw = {"brand_name": "TestBrand", "category": "Physical product", "audience": "Gen Z (18-25)", "usp": "First sustainable sneaker made from ocean waste"}
db.save_brand_dna("test-proj-001", json.dumps(raw), None)
result = db.get_brand_dna("test-proj-001")
assert result is not None
assert result["raw_fields"]["brand_name"] == "TestBrand"
assert result["enriched_fields"] is None
print("  [OK] save_brand_dna raw only -> get returns parsed dict")

# Test upsert with enriched
enriched = {"brand_archetype": "Explorer 70% + Rebel 30%", "tone_axis": "bold honesty", "visual_mood": "raw urban editorial", "content_pillars": ["Ocean Story", "Proof of Impact", "Street Culture"], "competitor_keywords": ["Nike", "Allbirds", "Veja", "Cariuma", "Patagonia"], "positioning_territory": "performance sustainability for Gen Z", "geo_tier": "India Tier 1 + Global"}
db.save_brand_dna("test-proj-001", json.dumps(raw), json.dumps(enriched))
result2 = db.get_brand_dna("test-proj-001")
assert result2["enriched_fields"]["brand_archetype"] == "Explorer 70% + Rebel 30%"
print("  [OK] upsert with enriched_fields -> parsed correctly")

print()
print("=" * 50)
print("TEST 2: run_crew.py — enrich_brief_with_dna")
print("=" * 50)
sys.path.insert(0, os.path.dirname(__file__))
from run_crew import enrich_brief_with_dna, normalize_brief

# main.py flattens raw+enriched before passing as _dna — simulate that
dna_flat = {**raw, **enriched}
base_brief = {"brand_name": "TestBrand", "notes": "some brief text"}
merged = enrich_brief_with_dna(base_brief, dna_flat)
assert merged.get("target_audience") == "Gen Z (18-25)", f"Expected Gen Z, got {merged.get('target_audience')}"
assert merged.get("brand_archetype") == "Explorer 70% + Rebel 30%"
assert merged.get("tone_axis") == "bold honesty"
assert "Ocean Story" in merged.get("content_pillars", "")
print("  [OK] enrich_brief_with_dna merges raw + enriched correctly")

# Test fallback (no DNA)
base2 = normalize_brief({"brief": "A cool sneaker brand"}, "TestBrand")
assert base2.get("brand_name") is not None
print("  [OK] normalize_brief fallback still works (no DNA)")

print()
print("=" * 50)
print("TEST 3: branding_crew.py — DNA injection in task prompts (text check)")
print("=" * 50)
# Read file directly to verify DNA injection strings are present — avoid crewai import
with open("branding_crew.py", "r", encoding="utf-8") as f:
    bc = f.read()
assert "brand_archetype" in bc, "brand_archetype not referenced in branding_crew.py"
print("  [OK] brand_archetype referenced in branding_crew.py")
assert "tone_axis" in bc, "tone_axis not referenced in branding_crew.py"
print("  [OK] tone_axis referenced in branding_crew.py")
assert "visual_mood" in bc, "visual_mood not referenced in branding_crew.py"
print("  [OK] visual_mood referenced in branding_crew.py")
assert "competitor_keywords" in bc, "competitor_keywords not referenced in branding_crew.py"
print("  [OK] competitor_keywords referenced in branding_crew.py")
assert "critique" in bc.lower() or "critic" in bc.lower(), "critique task not found in branding_crew.py"
print("  [OK] critique/critic task present in branding_crew.py")
print("  [OK] branding_crew.py checks passed")
# Block JSON is in run_crew.py (_save_branding_json)
with open("run_crew.py", "r", encoding="utf-8") as f:
    rc = f.read()
assert "_save_branding_json" in rc, "_save_branding_json not found in run_crew.py"
assert "positioning_statement" in rc, "block keys not found in run_crew.py"
print("  [OK] _save_branding_json block output present in run_crew.py")

print()
print("=" * 50)
print("TEST 4: research.py — run_headless_direct + L5 split (text check)")
print("=" * 50)
with open("research.py", "r", encoding="utf-8") as f:
    rs = f.read()
assert "def run_headless_direct" in rs, "run_headless_direct missing from research.py"
print("  [OK] run_headless_direct function defined in research.py")
assert "layer1_query_understanding" in rs, "layer1_query_understanding missing"
print("  [OK] layer1_query_understanding present")
assert "brand_archetype" in rs or "tone_axis" in rs, "DNA injection missing from research.py"
print("  [OK] DNA injection present in research.py (L1)")
# L5 split: should have two Claude calls in layer5_synthesis
l5_start = rs.find("def layer5_synthesis")
l5_end   = rs.find("\ndef ", l5_start + 1)
l5_body  = rs[l5_start:l5_end]
call_count = l5_body.count("ask_claude")
assert call_count >= 2, f"Expected 2+ ask_claude calls in layer5_synthesis, found {call_count}"
print(f"  [OK] L5 synthesis split into {call_count} Claude calls (truncation fix)")

print()
print("=" * 50)
print("ALL TESTS PASSED")
print("=" * 50)
