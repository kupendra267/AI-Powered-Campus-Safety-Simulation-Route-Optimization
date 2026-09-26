import os
import sys
import random
from datetime import datetime, timezone, timedelta

# Ensure project root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.app import create_app
from backend.extensions import db
from backend.models.campus import Building
from backend.models.crowd import CrowdData, SystemAlert

def seed_crowd_data():
    print(" [*] Generating Realistic Synthetic Crowd Records (Demo Simulation Data)...")
    buildings = Building.query.all()
    if not buildings:
        print(" [!] No campus buildings found. Please run seed_campus first.")
        return

    # Generate 72 hours of hourly historical records (past 3 days up to current hour)
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    total_records = 0

    for hour_offset in range(72, -1, -1):
        record_time = now - timedelta(hours=hour_offset)
        hour = record_time.hour
        is_weekend = record_time.weekday() >= 5

        for b in buildings:
            # Baseline calculation according to time of day & facility type
            if is_weekend:
                if b.type == 'HOSTEL':
                    ratio = random.uniform(0.60, 0.85)
                elif b.type == 'RECREATION':
                    ratio = random.uniform(0.50, 0.80)
                elif b.type == 'CANTEEN':
                    ratio = random.uniform(0.40, 0.70)
                else:
                    ratio = random.uniform(0.05, 0.20)
            else:
                # Weekday Diurnal Patterns
                if 8 <= hour <= 10:  # Morning Arrival & Class Start
                    if b.type in ['ACADEMIC', 'ADMIN', 'LAB']:
                        ratio = random.uniform(0.70, 0.88)
                    elif b.type == 'CANTEEN':
                        ratio = random.uniform(0.35, 0.55)
                    elif b.type == 'HOSTEL':
                        ratio = random.uniform(0.15, 0.30)
                    else:
                        ratio = random.uniform(0.20, 0.40)

                elif 11 <= hour <= 13:  # Midday & Lunch Rush
                    if b.type == 'CANTEEN':
                        ratio = random.uniform(0.85, 0.96)  # High / Critical Lunch Rush
                    elif b.type == 'LIBRARY':
                        ratio = random.uniform(0.65, 0.82)
                    elif b.type in ['ACADEMIC', 'LAB']:
                        ratio = random.uniform(0.40, 0.60)
                    elif b.type == 'HOSTEL':
                        ratio = random.uniform(0.20, 0.35)
                    else:
                        ratio = random.uniform(0.30, 0.50)

                elif 14 <= hour <= 16:  # Afternoon Labs & Lectures
                    if b.type in ['ACADEMIC', 'LAB']:
                        ratio = random.uniform(0.75, 0.90)
                    elif b.type == 'LIBRARY':
                        ratio = random.uniform(0.55, 0.75)
                    elif b.type == 'CANTEEN':
                        ratio = random.uniform(0.30, 0.45)
                    else:
                        ratio = random.uniform(0.20, 0.35)

                elif 17 <= hour <= 20:  # Evening Dispersal, Gym & Hostel Return
                    if b.type == 'RECREATION':
                        ratio = random.uniform(0.75, 0.92)  # Sports peak
                    elif b.type == 'HOSTEL':
                        ratio = random.uniform(0.65, 0.85)
                    elif b.type == 'AUDITORIUM':
                        ratio = random.uniform(0.40, 0.75)
                    elif b.type in ['ACADEMIC', 'ADMIN', 'LAB']:
                        ratio = random.uniform(0.08, 0.20)
                    else:
                        ratio = random.uniform(0.30, 0.50)

                else:  # Night (21:00 - 07:00)
                    if b.type == 'HOSTEL':
                        ratio = random.uniform(0.75, 0.95)
                    else:
                        ratio = random.uniform(0.02, 0.10)

            # Calculate count
            crowd_count = max(5, int(b.capacity * ratio))
            density, congestion = CrowdData.compute_density_and_congestion(crowd_count, b.capacity)

            record = CrowdData(
                location_id=b.id,
                timestamp=record_time,
                crowd_count=crowd_count,
                capacity=b.capacity,
                density_percentage=density,
                congestion_level=congestion,
                source='SIMULATION'
            )
            db.session.add(record)
            total_records += 1

            # For recent hours (last 2 hours), add alerts if High or Critical
            if hour_offset <= 2 and congestion in ['HIGH', 'CRITICAL']:
                alert = SystemAlert(
                    title=f"{congestion} Congestion: {b.name}",
                    message=f"Live crowd density: {density}% ({crowd_count}/{b.capacity} people) at {b.name}.",
                    alert_type='CONGESTION',
                    severity='DANGER' if congestion == 'CRITICAL' else 'WARNING',
                    related_location_id=b.id,
                    created_at=record_time
                )
                db.session.add(alert)

    db.session.commit()
    print(f" [+] Successfully created {total_records} synthetic crowd records across 72 hours.")
    print(" [OK] Crowd Data Seeding Completed Successfully!")

if __name__ == '__main__':
    app = create_app('development')
    with app.app_context():
        seed_crowd_data()
