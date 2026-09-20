from datetime import date
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_api_suite():
    print("--- 1. Testing Health Check ---")
    res = client.get("/")
    assert res.status_code == 200
    print("Health check response:", res.json())

    print("\n--- 2. Testing Mandi Centers List ---")
    res = client.get("/mandi-centers")
    assert res.status_code == 200
    centers = res.json()
    print(f"Found {len(centers)} Mandi centers.")
    assert len(centers) >= 1

    print("\n--- 3. Testing Dynamic Capacity Booking (Valid) ---")
    booking_payload = {
        "farmer_id": "TEST-FARMER-01",
        "farmer_name": "Kisan Kumar",
        "farmer_mobile": "9812345678",
        "mandi_id": 1,
        "booking_date": "2026-10-15",
        "crop_type": "Wheat",
        "estimated_quintals": 40.0
    }
    res = client.post("/book-slot", json=booking_payload)
    assert res.status_code == 201, f"Failed: {res.text}"
    data = res.json()
    token_id = data["token_id"]
    print("Booked slot successfully. Token:", token_id)
    assert "MM-2026-" in token_id
    assert data["status"] == "SLOT_BOOKED"

    print("\n--- 4. Testing Capacity Limit Exceeded (Invalid, > 1500 Qtl) ---")
    oversized_payload = {
        "farmer_id": "TEST-FARMER-OVERFLOW",
        "farmer_name": "Massive Grain Co",
        "mandi_id": 1,
        "booking_date": "2026-10-15",
        "crop_type": "Wheat",
        "estimated_quintals": 2000.0  # Every center has a 1500 Qtl capacity
    }
    res = client.post("/book-slot", json=oversized_payload)
    assert res.status_code == 400
    print("Successfully rejected over-capacity request:", res.json()["detail"])

    print("\n--- 5. Testing IoT Weighbridge Integration ---")
    # Bad secret
    bad_iot = {
        "token_id": token_id,
        "weight_quintals": 41.5,
        "secret_key": "WRONG_SECRET"
    }
    res = client.post("/iot/weigh-update", json=bad_iot)
    assert res.status_code == 401
    print("Successfully rejected unauthorized IoT sensor ping.")

    # Valid secret
    good_iot = {
        "token_id": token_id,
        "weight_quintals": 41.5,
        "secret_key": "KANTA_SECRET_2026"
    }
    res = client.post("/iot/weigh-update", json=good_iot)
    assert res.status_code == 200
    iot_res = res.json()
    print("IoT Weighbridge update successful:", iot_res)
    assert iot_res["updated_status"] == "WEIGHED"
    assert iot_res["recorded_weight_quintals"] == 41.5

    print("\n--- 6. Testing Slot Status by Token ---")
    res = client.get(f"/slots/{token_id}")
    assert res.status_code == 200
    assert res.json()["status"] == "WEIGHED"
    print("Verified slot status in DB is WEIGHED.")

    print("\n--- 7. Testing Clerk Queue ---")
    res = client.get("/slots/today")
    assert res.status_code == 200
    queue = res.json()
    print(f"Clerk today's queue count: {len(queue)}")
    assert len(queue) > 0

    print("\n=== ALL BACKEND API TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    test_api_suite()
