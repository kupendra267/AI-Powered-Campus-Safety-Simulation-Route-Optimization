import os
import sys

# Ensure project root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.app import create_app
from backend.extensions import db
from backend.models.campus import Node, Building, Path, Exit
from backend.models.user import User

def seed_campus_topology():
    print(" [*] Seeding Campus Topology (Nodes, Buildings, Paths, Exits)...")

    # 1. NODES
    nodes_data = [
        # Building Nodes
        {"id": 1, "name": "Admin Complex Hub", "latitude": 12.97160, "longitude": 77.59460, "node_type": "BUILDING"},
        {"id": 2, "name": "CS & AI Complex Hub", "latitude": 12.97300, "longitude": 77.59350, "node_type": "BUILDING"},
        {"id": 3, "name": "Electrical Sciences Hub", "latitude": 12.97320, "longitude": 77.59600, "node_type": "BUILDING"},
        {"id": 4, "name": "Mechanical Quad Hub", "latitude": 12.97050, "longitude": 77.59650, "node_type": "BUILDING"},
        {"id": 5, "name": "Central Library Plaza", "latitude": 12.97180, "longitude": 77.59250, "node_type": "BUILDING"},
        {"id": 6, "name": "Auditorium Plaza", "latitude": 12.97000, "longitude": 77.59320, "node_type": "BUILDING"},
        {"id": 7, "name": "Food Court Square", "latitude": 12.97150, "longitude": 77.59580, "node_type": "BUILDING"},
        {"id": 8, "name": "Sports Arena Entrance", "latitude": 12.96920, "longitude": 77.59500, "node_type": "BUILDING"},
        {"id": 9, "name": "Alpha Hostel Quad", "latitude": 12.97450, "longitude": 77.59300, "node_type": "BUILDING"},
        {"id": 10, "name": "Beta Hostel Quad", "latitude": 12.97420, "longitude": 77.59650, "node_type": "BUILDING"},
        {"id": 11, "name": "Research Park Hub", "latitude": 12.97250, "longitude": 77.59100, "node_type": "BUILDING"},
        {"id": 12, "name": "Health Center Entrance", "latitude": 12.97080, "longitude": 77.59180, "node_type": "BUILDING"},

        # Intermediary Corridors & Junctions
        {"id": 13, "name": "North Perimeter Junction", "latitude": 12.97500, "longitude": 77.59450, "node_type": "JUNCTION"},
        {"id": 14, "name": "East Crossing", "latitude": 12.97200, "longitude": 77.59750, "node_type": "JUNCTION"},
        {"id": 15, "name": "South Boulevard Junction", "latitude": 12.96880, "longitude": 77.59380, "node_type": "JUNCTION"},
        {"id": 16, "name": "West Promenade Junction", "latitude": 12.97120, "longitude": 77.59050, "node_type": "JUNCTION"},
        {"id": 17, "name": "Central Quadrangle Crossing", "latitude": 12.97220, "longitude": 77.59420, "node_type": "JUNCTION"},
        {"id": 18, "name": "Academic Link Waypoint", "latitude": 12.97350, "longitude": 77.59480, "node_type": "JUNCTION"},
        {"id": 19, "name": "South-East Walkway", "latitude": 12.96980, "longitude": 77.59680, "node_type": "JUNCTION"},
        {"id": 20, "name": "North-West Link", "latitude": 12.97380, "longitude": 77.59180, "node_type": "JUNCTION"},

        # Exit Gate Nodes
        {"id": 21, "name": "Gate 1 - Main North Terminal", "latitude": 12.97580, "longitude": 77.59450, "node_type": "EXIT"},
        {"id": 22, "name": "Gate 2 - South Ring Terminal", "latitude": 12.96800, "longitude": 77.59380, "node_type": "EXIT"},
        {"id": 23, "name": "Gate 3 - East City Gate", "latitude": 12.97200, "longitude": 77.59880, "node_type": "EXIT"},
        {"id": 24, "name": "Gate 4 - West Emergency Gate", "latitude": 12.97120, "longitude": 77.58950, "node_type": "EXIT"}
    ]

    for nd in nodes_data:
        existing = db.session.get(Node, nd["id"])
        if not existing:
            node = Node(
                id=nd["id"],
                name=nd["name"],
                latitude=nd["latitude"],
                longitude=nd["longitude"],
                node_type=nd["node_type"]
            )
            db.session.add(node)

    db.session.commit()
    print(f" [+] Verified/Added {len(nodes_data)} campus nodes.")

    # 2. BUILDINGS
    buildings_data = [
        {"name": "Main Administrative Complex", "building_code": "ADM-01", "node_id": 1, "latitude": 12.97160, "longitude": 77.59460, "capacity": 400, "type": "ADMIN", "description": "University Directorate, Registrar office, Examination cell."},
        {"name": "Turing CS & AI Complex", "building_code": "CS-01", "node_id": 2, "latitude": 12.97300, "longitude": 77.59350, "capacity": 850, "type": "ACADEMIC", "description": "High Performance Computing Labs, AI Research Hub, Department Classrooms."},
        {"name": "Faraday Electrical Sciences", "building_code": "EE-01", "node_id": 3, "latitude": 12.97320, "longitude": 77.59600, "capacity": 600, "type": "ACADEMIC", "description": "VLSI design center, IoT laboratories, and Embedded Systems wing."},
        {"name": "DaVinci Mechanical Quad", "building_code": "ME-01", "node_id": 4, "latitude": 12.97050, "longitude": 77.59650, "capacity": 650, "type": "ACADEMIC", "description": "Robotics workshops, CAD/CAM studios, and Fluid Mechanics labs."},
        {"name": "Central University Library", "building_code": "LIB-01", "node_id": 5, "latitude": 12.97180, "longitude": 77.59250, "capacity": 500, "type": "LIBRARY", "description": "Digital archive, quiet reading halls, and media conference rooms."},
        {"name": "Grand University Auditorium", "building_code": "AUD-01", "node_id": 6, "latitude": 12.97000, "longitude": 77.59320, "capacity": 1200, "type": "AUDITORIUM", "description": "Main campus convention center, theater, and convocation hall."},
        {"name": "Student Food Court & Cafeteria", "building_code": "FC-01", "node_id": 7, "latitude": 12.97150, "longitude": 77.59580, "capacity": 750, "type": "CANTEEN", "description": "Central dining area with multiple food stalls and outdoor seating."},
        {"name": "Sports Arena & Gymnasium", "building_code": "SPT-01", "node_id": 8, "latitude": 12.96920, "longitude": 77.59500, "capacity": 500, "type": "RECREATION", "description": "Indoor basketball courts, fitness gym, and badminton courts."},
        {"name": "Alpha Boys Residence", "building_code": "HST-01", "node_id": 9, "latitude": 12.97450, "longitude": 77.59300, "capacity": 600, "type": "HOSTEL", "description": "Four-story undergraduate student accommodation."},
        {"name": "Beta Girls Residence", "building_code": "HST-02", "node_id": 10, "latitude": 12.97420, "longitude": 77.59650, "capacity": 600, "type": "HOSTEL", "description": "Four-story student residence with private courtyard."},
        {"name": "Innovation & Research Labs", "building_code": "RES-01", "node_id": 11, "latitude": 12.97250, "longitude": 77.59100, "capacity": 350, "type": "LAB", "description": "Incubation center, industry research partnerships, and prototyping labs."},
        {"name": "Health & First Aid Center", "building_code": "MED-01", "node_id": 12, "latitude": 12.97080, "longitude": 77.59180, "capacity": 150, "type": "MEDICAL", "description": "24/7 campus medical dispensary and emergency response unit."}
    ]

    for bd in buildings_data:
        existing = Building.query.filter_by(building_code=bd["building_code"]).first()
        if not existing:
            b = Building(
                name=bd["name"],
                building_code=bd["building_code"],
                node_id=bd["node_id"],
                latitude=bd["latitude"],
                longitude=bd["longitude"],
                capacity=bd["capacity"],
                type=bd["type"],
                description=bd["description"]
            )
            db.session.add(b)

    db.session.commit()
    print(f" [+] Verified/Added {len(buildings_data)} campus buildings.")

    # 3. EXITS
    exits_data = [
        {"name": "Gate 1 - Main North Terminal", "node_id": 21, "capacity": 600, "status": "ACTIVE", "description": "Primary northern vehicular and pedestrian gate on University Highway."},
        {"name": "Gate 2 - South Ring Terminal", "node_id": 22, "capacity": 550, "status": "ACTIVE", "description": "Southern exit connecting to South Ring Road and metro station."},
        {"name": "Gate 3 - East City Gate", "node_id": 23, "capacity": 450, "status": "ACTIVE", "description": "Eastern pedestrian gateway toward technology park and city bus terminal."},
        {"name": "Gate 4 - West Emergency Gate", "node_id": 24, "capacity": 400, "status": "ACTIVE", "description": "Dedicated emergency access gate for ambulances and fire engines."}
    ]

    for ed in exits_data:
        existing = Exit.query.filter_by(name=ed["name"]).first()
        if not existing:
            e = Exit(
                name=ed["name"],
                node_id=ed["node_id"],
                capacity=ed["capacity"],
                status=ed["status"],
                description=ed["description"]
            )
            db.session.add(e)

    db.session.commit()
    print(f" [+] Verified/Added {len(exits_data)} campus emergency exits.")

    # 4. PATHS
    # Constructing a rich, connected graph
    paths_pairs = [
        # Central spine connections
        (1, 17, 150),   # Admin <-> Central Quad
        (1, 7, 180),    # Admin <-> Food Court
        (1, 5, 240),    # Admin <-> Library
        (1, 6, 230),    # Admin <-> Auditorium
        
        # Central Quad to Academic Buildings
        (17, 2, 170),   # Central Quad <-> CS Complex
        (17, 18, 160),  # Central Quad <-> Academic Link
        (18, 2, 150),   # Academic Link <-> CS Complex
        (18, 3, 140),   # Academic Link <-> Electrical
        (17, 7, 190),   # Central Quad <-> Food Court
        
        # Food Court connections
        (7, 3, 200),    # Food Court <-> Electrical
        (7, 4, 160),    # Food Court <-> Mechanical
        (7, 14, 190),   # Food Court <-> East Crossing
        
        # East Corridor & Gate 3
        (3, 10, 155),   # Electrical <-> Beta Hostel
        (4, 14, 180),   # Mechanical <-> East Crossing
        (4, 19, 110),   # Mechanical <-> South-East Walkway
        (14, 23, 140),  # East Crossing <-> Gate 3 [EXIT]
        (14, 10, 250),  # East Crossing <-> Beta Hostel
        (19, 8, 210),   # South-East Walkway <-> Sports Arena
        
        # Hostels and North Perimeter & Gate 1
        (9, 13, 170),   # Alpha Hostel <-> North Perimeter
        (10, 13, 230),  # Beta Hostel <-> North Perimeter
        (18, 13, 180),  # Academic Link <-> North Perimeter
        (2, 9, 175),    # CS Complex <-> Alpha Hostel
        (13, 21, 100),  # North Perimeter <-> Gate 1 [EXIT]
        
        # West Wing & Gate 4
        (2, 20, 200),   # CS Complex <-> North-West Link
        (9, 20, 150),   # Alpha Hostel <-> North-West Link
        (20, 11, 170),  # North-West Link <-> Research Park
        (5, 11, 180),   # Library <-> Research Park
        (5, 12, 135),   # Library <-> Health Center
        (11, 16, 160),  # Research Park <-> West Promenade
        (12, 16, 150),  # Health Center <-> West Promenade
        (16, 24, 110),  # West Promenade <-> Gate 4 [EXIT]
        
        # South Wing & Gate 2
        (6, 12, 180),   # Auditorium <-> Health Center
        (6, 15, 150),   # Auditorium <-> South Boulevard
        (6, 8, 220),    # Auditorium <-> Sports Arena
        (8, 15, 140),   # Sports Arena <-> South Boulevard
        (15, 22, 90),   # South Boulevard <-> Gate 2 [EXIT]
        (4, 8, 210)     # Mechanical <-> Sports Arena
    ]

    for src_id, dest_id, default_dist in paths_pairs:
        # Check if path already exists in either direction
        existing = Path.query.filter(
            ((Path.source_node_id == src_id) & (Path.destination_node_id == dest_id)) |
            ((Path.source_node_id == dest_id) & (Path.destination_node_id == src_id))
        ).first()

        if not existing:
            src_node = db.session.get(Node, src_id)
            dest_node = db.session.get(Node, dest_id)
            
            calc_dist = default_dist
            if src_node and dest_node:
                calc_dist = Path.calculate_haversine_distance(
                    src_node.latitude, src_node.longitude,
                    dest_node.latitude, dest_node.longitude
                )

            path = Path(
                source_node_id=src_id,
                destination_node_id=dest_id,
                distance_meters=float(calc_dist),
                capacity=150,
                current_crowd=0,
                status='OPEN',
                is_bidirectional=True,
                emergency_safe=True
            )
            db.session.add(path)

    db.session.commit()
    print(f" [+] Verified/Added {len(paths_pairs)} campus corridor paths.")
    print(" [OK] Campus Topology Seeding Completed Successfully!")

if __name__ == '__main__':
    app = create_app('development')
    with app.app_context():
        db.create_all()
        seed_campus_topology()
