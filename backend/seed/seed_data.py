import os
import sys

# Ensure project root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.app import create_app
from backend.extensions import db
from backend.seed.seed_users import seed_default_users
from backend.seed.seed_campus import seed_campus_topology
from backend.seed.seed_crowd import seed_crowd_data

def run_all_seeds():
    print("==================================================")
    print("  AI-Powered Campus Master Initializer & Seeder")
    print("==================================================")
    app = create_app('development')
    with app.app_context():
        db.create_all()
        print("\n--- 1. Seeding User Accounts ---")
        seed_default_users()
        print("\n--- 2. Seeding Campus Topology ---")
        seed_campus_topology()
        print("\n--- 3. Seeding Realistic Crowd Records ---")
        seed_crowd_data()
        print("\n==================================================")
        print("  All Database Seeds Completed Successfully!")
        print("==================================================")

if __name__ == '__main__':
    run_all_seeds()
