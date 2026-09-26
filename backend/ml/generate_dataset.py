"""
Synthetic Campus Crowd Dataset Generator
========================================
Generates realistic, physically-grounded historical crowd time-series datasets 
for academic demonstration and ML model training.

DISCLAIMER:
"Synthetic/Simulation Data — For Academic Demonstration"
Patterns are mathematically modeled around real-world college scheduling (class schedules,
meal hours, library study habits, and hostel occupancy), not recorded human tracking data.
"""

import os
import math
import random
import numpy as np
import pandas as pd
from datetime import datetime, timedelta, timezone

DATASET_DISCLAIMER = "Synthetic/Simulation Data — For Academic Demonstration"

# Campus Facility Profiles matching database seed
FACILITIES = [
    {"id": 1, "name": "Admin Complex Hub", "code": "ADM-01", "type": "ADMIN", "capacity": 300},
    {"id": 2, "name": "CS & AI Complex Hub", "code": "CS-01", "type": "ACADEMIC", "capacity": 800},
    {"id": 3, "name": "Electrical Sciences Hub", "code": "EE-01", "type": "ACADEMIC", "capacity": 650},
    {"id": 4, "name": "Mechanical Quad Hub", "code": "ME-01", "type": "ACADEMIC", "capacity": 600},
    {"id": 5, "name": "Central Library Plaza", "code": "LIB-01", "type": "LIBRARY", "capacity": 700},
    {"id": 6, "name": "Auditorium Plaza", "code": "AUD-01", "type": "AUDITORIUM", "capacity": 1000},
    {"id": 7, "name": "Food Court Square", "code": "CAN-01", "type": "CANTEEN", "capacity": 550},
    {"id": 8, "name": "Sports Arena Entrance", "code": "SPT-01", "type": "SPORTS", "capacity": 450},
    {"id": 9, "name": "Alpha Hostel Quad", "code": "HST-01", "type": "HOSTEL", "capacity": 500},
    {"id": 10, "name": "Beta Hostel Quad", "code": "HST-02", "type": "HOSTEL", "capacity": 500},
    {"id": 11, "name": "Research Park Hub", "code": "RES-01", "type": "LAB", "capacity": 350},
    {"id": 12, "name": "Health Center Entrance", "code": "MED-01", "type": "MEDICAL", "capacity": 150}
]

def calculate_expected_occupancy_ratio(facility_type, hour, is_weekend, day_of_week):
    """
    Computes deterministic base crowd occupancy ratio (0.0 to 1.0)
    conditioned on facility type, time-of-day, and day-of-week.
    """
    if is_weekend:
        if facility_type == "HOSTEL":
            # High occupancy on weekends
            if 0 <= hour <= 10 or 20 <= hour <= 23:
                return 0.82 + 0.08 * math.sin((hour / 24.0) * math.pi)
            return 0.55 + 0.15 * math.sin((hour / 14.0) * math.pi)
        elif facility_type == "SPORTS":
            # Weekend peak in late morning and evening
            if 7 <= hour <= 11 or 16 <= hour <= 20:
                return 0.65 + 0.20 * math.sin((hour / 8.0) * math.pi)
            return 0.15
        elif facility_type == "CANTEEN":
            if 9 <= hour <= 14 or 19 <= hour <= 21:
                return 0.50 + 0.20 * math.cos((hour - 13) * 0.4)
            return 0.10
        elif facility_type == "LIBRARY":
            if 10 <= hour <= 18:
                return 0.40 + 0.15 * math.sin((hour - 10) * 0.4)
            return 0.05
        else:
            # Most academic/admin facilities are minimally occupied on weekends
            return 0.05 + 0.05 * math.sin((hour / 24.0) * math.pi)

    # Weekday Schedule
    if facility_type == "ACADEMIC" or facility_type == "LAB":
        if 8 <= hour < 12:
            # Morning lecture block
            return 0.70 + 0.18 * math.sin((hour - 8) * 0.8)
        elif 12 <= hour < 14:
            # Lunch lull
            return 0.35 + 0.10 * math.sin((hour - 12) * math.pi)
        elif 14 <= hour < 17:
            # Afternoon lab/seminar block
            return 0.75 + 0.15 * math.sin((hour - 14) * 0.9)
        elif 17 <= hour < 20:
            # Evening self-study / clubs
            return 0.25 - 0.06 * (hour - 17)
        else:
            # Night
            return 0.04

    elif facility_type == "CANTEEN":
        if 7 <= hour < 9:
            # Breakfast
            return 0.45 + 0.15 * math.sin((hour - 7) * 1.5)
        elif 9 <= hour < 12:
            # Low between meals
            return 0.18 + 0.06 * math.sin((hour - 9) * 0.8)
        elif 12 <= hour < 14:
            # Massive Lunch Surge (Peak Congestion)
            return 0.88 + 0.10 * math.sin((hour - 12) * math.pi)
        elif 16 <= hour < 18:
            # Evening Snacks
            return 0.55 + 0.15 * math.sin((hour - 16) * 1.2)
        elif 19 <= hour < 22:
            # Dinner
            return 0.65 + 0.15 * math.sin((hour - 19) * 1.0)
        else:
            return 0.02

    elif facility_type == "LIBRARY":
        if 8 <= hour < 12:
            return 0.35 + 0.15 * math.sin((hour - 8) * 0.7)
        elif 12 <= hour < 17:
            return 0.60 + 0.20 * math.sin((hour - 12) * 0.6)
        elif 17 <= hour < 22:
            # Peak evening study hours
            return 0.75 + 0.15 * math.sin((hour - 17) * 0.6)
        else:
            return 0.05

    elif facility_type == "HOSTEL":
        # Inverted schedule compared to academic buildings
        if 0 <= hour < 8:
            return 0.88 + 0.08 * math.cos(hour * 0.3)
        elif 8 <= hour < 17:
            return 0.15 + 0.08 * math.sin((hour - 8) * 0.4)
        elif 17 <= hour < 21:
            return 0.50 + 0.20 * math.sin((hour - 17) * 0.7)
        else:
            return 0.85 + 0.10 * math.sin((hour - 21) * 0.9)

    elif facility_type == "AUDITORIUM":
        # Occasional seminars on Wed/Fri afternoons
        if day_of_week in [2, 4] and 14 <= hour <= 17:
            return 0.80 + 0.12 * math.sin((hour - 14) * 0.9)
        return 0.08 + 0.04 * math.sin(hour * 0.2)

    elif facility_type == "ADMIN":
        if 9 <= hour <= 17:
            return 0.50 + 0.18 * math.sin((hour - 9) * 0.4)
        return 0.05

    elif facility_type == "MEDICAL":
        if 8 <= hour <= 18:
            return 0.35 + 0.15 * math.sin((hour - 8) * 0.3)
        return 0.10

    elif facility_type == "SPORTS":
        if 6 <= hour <= 8 or 17 <= hour <= 20:
            return 0.70 + 0.18 * math.sin((hour - 17) * 0.8)
        return 0.10

    return 0.20


def generate_campus_crowd_dataset(days=90, start_date=None, output_path=None):
    """
    Generates time-series hourly crowd records for all campus facilities.
    Includes temporal lag features and rolling averages without future leakage.
    """
    if start_date is None:
        start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Align to start of day
    start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
    
    total_hours = days * 24
    records = []
    
    np.random.seed(42)
    random.seed(42)

    print(f"[*] Generating {days} days ({total_hours} hours) of synthetic crowd records for {len(FACILITIES)} facilities...")

    for facility in FACILITIES:
        f_id = facility["id"]
        f_type = facility["type"]
        capacity = facility["capacity"]

        facility_records = []
        prev_crowd = int(capacity * 0.1)

        for h_step in range(total_hours):
            current_time = start_date + timedelta(hours=h_step)
            hour = current_time.hour
            day_of_week = current_time.weekday()  # 0=Mon, 6=Sun
            day_of_month = current_time.day
            month = current_time.month
            is_weekend = 1 if day_of_week >= 5 else 0

            # Base occupancy ratio
            base_ratio = calculate_expected_occupancy_ratio(f_type, hour, is_weekend, day_of_week)

            # Add structured Gaussian noise (simulating natural crowd variance, weather, random events)
            noise = np.random.normal(loc=0.0, scale=0.04)
            
            # Event surge probability (e.g. tech fest, guest talk, campus exam)
            event_surge = 0.0
            if not is_weekend and random.random() < 0.02 and 10 <= hour <= 16:
                event_surge = np.random.uniform(0.15, 0.35)

            effective_ratio = np.clip(base_ratio + noise + event_surge, 0.02, 1.05)
            crowd_count = int(round(effective_ratio * capacity))
            crowd_count = max(0, crowd_count)

            density_pct = round((crowd_count / capacity) * 100, 2)
            if density_pct <= 40.0:
                congestion = 'LOW'
            elif density_pct <= 70.0:
                congestion = 'MEDIUM'
            elif density_pct <= 90.0:
                congestion = 'HIGH'
            else:
                congestion = 'CRITICAL'

            record = {
                "location_id": f_id,
                "location_name": facility["name"],
                "location_code": facility["code"],
                "facility_type": f_type,
                "capacity": capacity,
                "timestamp": current_time.isoformat(),
                "hour": hour,
                "day_of_week": day_of_week,
                "day_of_month": day_of_month,
                "month": month,
                "is_weekend": is_weekend,
                "crowd_count": crowd_count,
                "density_percentage": density_pct,
                "congestion_level": congestion,
                "dataset_type": DATASET_DISCLAIMER
            }
            facility_records.append(record)

        # Compute lag features per facility chronologically
        f_df = pd.DataFrame(facility_records)
        f_df['previous_crowd'] = f_df['crowd_count'].shift(1).fillna(f_df['crowd_count'].iloc[0]).astype(int)
        f_df['lag_2_crowd'] = f_df['crowd_count'].shift(2).fillna(f_df['crowd_count'].iloc[0]).astype(int)
        f_df['rolling_average_3h'] = f_df['crowd_count'].shift(1).rolling(window=3, min_periods=1).mean().fillna(f_df['crowd_count'].iloc[0]).round(1)
        f_df['previous_density'] = ((f_df['previous_crowd'] / f_df['capacity']) * 100).round(2)

        records.extend(f_df.to_dict('records'))

    df = pd.DataFrame(records)
    # Sort chronologically by timestamp and location
    df.sort_values(by=['timestamp', 'location_id'], inplace=True)
    df.reset_index(drop=True, inplace=True)

    if output_path:
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        df.to_csv(output_path, index=False)
        print(f" [OK] Dataset successfully written to: {output_path} ({len(df)} rows)")

    return df


if __name__ == "__main__":
    default_csv = os.path.join(os.path.dirname(__file__), "data", "campus_crowd_synthetic.csv")
    generate_campus_crowd_dataset(days=90, output_path=default_csv)
