"""
Root Database Seed and Initialization Script
============================================
Run this script to initialize all database tables and populate demo data:
  - Default Admin & Student Accounts
  - Complete Campus Topology (Buildings, Nodes, Corridors, Exits)
  - Historical & Current Crowd Data Records
  - Default Emergency Scenarios & Configurations

Usage:
  python seed.py
"""

import os
import sys

# Ensure backend package is in path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from backend.app import create_app
from backend.extensions import db
from backend.seed.seed_users import seed_default_users
from backend.seed.seed_campus import seed_campus_topology
from backend.seed.seed_crowd import seed_crowd_data
from backend.models.optimization import OptimizationConfig
from backend.models.emergency import EmergencyScenario
import json

def seed_database():
    print("=" * 60)
    print("  AI-Powered Campus — Master Database Initialization & Seed")
    print("=" * 60)
    
    app = create_app('development')
    with app.app_context():
        print("\n[*] 1. Creating Database Schema Tables...")
        db.create_all()
        print("    [OK] Tables verified.")

        print("\n[*] 2. Seeding Demo User Accounts...")
        seed_default_users()

        print("\n[*] 3. Seeding Campus Spatial Graph Topology...")
        seed_campus_topology()

        print("\n[*] 4. Seeding Realistic Crowd Density Records...")
        seed_crowd_data()

        print("\n[*] 5. Seeding Default Optimization Config & Scenarios...")
        OptimizationConfig.get_or_create()

        # Seed initial emergency scenario if not present
        if EmergencyScenario.query.count() == 0:
            sc = EmergencyScenario(
                name="Computer Science Quad Fire Evacuation",
                emergency_type="FIRE",
                severity="HIGH",
                description="Simulated emergency event in CS Block requiring immediate diversion to Perimeter Exits.",
                affected_building_ids=json.dumps([2]),
                blocked_path_ids=json.dumps([]),
                status="INACTIVE"
            )
            db.session.add(sc)
            db.session.commit()
            print("    [OK] Default Emergency Scenario seeded.")

        print("\n" + "=" * 60)
        print("  Database Initialized & Seeded Successfully!")
        print("  Demo Credentials:")
        print("    - Admin   : admin@campus.edu   / Admin@123")
        print("    - Student : student@campus.edu / Student@123")
        print("=" * 60)

if __name__ == '__main__':
    seed_database()
