import requests
import csv
import time
from requests.auth import HTTPBasicAuth

API_KEY = "4be9d3c4c82745b98b6a5063ea8424a3"
YEAR = 2025

# According to API documentation:
# - Endpoint: https://api.burningman.org/api/v1/camp?year={YEAR}
# - Authentication: Basic Auth with API key as username and empty password
BASE_URL = "https://api.burningman.org/api/v1/camp"
PARAMS = {"year": YEAR}

# Use Basic Authentication (API key as username, empty password)
auth = HTTPBasicAuth(API_KEY, '')

all_camps = []

print(f"🚀 Fetching camps from Burning Man API for year {YEAR}...\n")

# Try fetching with pagination
page = 1
while True:
    print(f"Fetching page {page}...")
    current_params = PARAMS.copy()
    if page > 1:
        current_params["page"] = page
    
    try:
        response = requests.get(BASE_URL, auth=auth, params=current_params)
        print(f"  Status code: {response.status_code}")

        if response.status_code != 200:
            if page == 1:
                print(f"❌ Error {response.status_code}")
                if response.text:
                    print(f"   Response: {response.text[:500]}")
                # If 401, the API key might be invalid
                if response.status_code == 401:
                    print("\n⚠️  Authentication failed. Please verify:")
                    print("   1. The API key is valid and active")
                    print("   2. The API key has not expired")
                    print("   3. The API key has permission to access camp data")
            else:
                # No more pages
                print(f"✅ Reached end at page {page-1}")
            break

        # Check content type to see if we got JSON
        content_type = response.headers.get('Content-Type', '').lower()
        if 'json' not in content_type:
            print(f"❌ Unexpected Content-Type: {content_type}")
            if page == 1:
                print(f"   Response text (first 500 chars): {response.text[:500]}")
            break

        # Check if response is actually JSON
        try:
            data = response.json()
        except ValueError as e:
            print(f"❌ Failed to parse JSON response: {e}")
            if page == 1:
                print(f"   Response text (first 500 chars): {response.text[:500]}")
            break

        # Handle different response structures
        if isinstance(data, dict):
            # Maybe wrapped in data, camps, results, etc.
            if 'data' in data:
                camps_data = data['data']
            elif 'camps' in data:
                camps_data = data['camps']
            elif 'results' in data:
                camps_data = data['results']
            elif 'items' in data:
                camps_data = data['items']
            else:
                print(f"❌ Unexpected response structure: {list(data.keys())}")
                break
        elif isinstance(data, list):
            camps_data = data
        else:
            print(f"❌ Unexpected response type: {type(data)}")
            break

        if not camps_data:
            print("✅ No more pages.")
            break

        print(f"  ✅ Retrieved {len(camps_data)} camps")
        all_camps.extend(camps_data)
        
        # Check if there might be more pages (if less than expected per page, might be last page)
        # This is a heuristic - adjust based on API behavior
        if len(camps_data) < 100:  # Assuming pages are typically 100 items
            print("✅ Likely last page (less than 100 items)")
            break
            
        page += 1

        # Safety delay (avoid rate limit)
        time.sleep(0.5)
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Request error: {e}")
        break

# Write to CSV
output_file = "burningman_2025_camps.csv"
if all_camps:
    print(f"\n📝 Writing {len(all_camps)} camps to {output_file}...")
    with open(output_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Name", "Contact Email", "Hometown", "Description", "Location"])
        for camp in all_camps:
            writer.writerow([
                camp.get("name", ""),
                camp.get("contact_email", ""),
                camp.get("hometown", ""),
                camp.get("description", "")[:500] if camp.get("description") else "",  # Limit description length
                camp.get("location_string", "")
            ])
    print(f"✅ Done! Exported {len(all_camps)} camps to {output_file}")
    
    # Also extract just emails to a separate file
    emails_file = "burningman_2025_emails.csv"
    emails = [camp.get("contact_email") for camp in all_camps if camp.get("contact_email")]
    if emails:
        with open(emails_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["Email"])
            for email in emails:
                writer.writerow([email])
        print(f"✅ Also exported {len(emails)} unique email addresses to {emails_file}")
else:
    print(f"\n❌ No camps retrieved. Check the API key and year.")
