import math
from datetime import datetime, timezone
from backend.extensions import db

class Node(db.Model):
    __tablename__ = 'nodes'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    node_type = db.Column(db.String(30), nullable=False, default='JUNCTION')  # BUILDING, JUNCTION, GATEWAY, EXIT
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    buildings = db.relationship('Building', backref='node', lazy=True, cascade='all, delete-orphan')
    exits = db.relationship('Exit', backref='node', lazy=True, cascade='all, delete-orphan')
    
    # Paths originating from this node
    outgoing_paths = db.relationship(
        'Path', 
        foreign_keys='Path.source_node_id', 
        backref='source_node', 
        lazy=True, 
        cascade='all, delete-orphan'
    )
    # Paths terminating at this node
    incoming_paths = db.relationship(
        'Path', 
        foreign_keys='Path.destination_node_id', 
        backref='destination_node', 
        lazy=True, 
        cascade='all, delete-orphan'
    )

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'node_type': self.node_type,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    def __repr__(self):
        return f"<Node {self.id}: {self.name} ({self.node_type})>"


class Building(db.Model):
    __tablename__ = 'buildings'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    building_code = db.Column(db.String(30), unique=True, nullable=False, index=True)
    node_id = db.Column(db.Integer, db.ForeignKey('nodes.id', ondelete='CASCADE'), nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    capacity = db.Column(db.Integer, nullable=False, default=500)
    type = db.Column(db.String(50), nullable=False, default='ACADEMIC')  # ACADEMIC, LIBRARY, CANTEEN, HOSTEL, ADMIN, AUDITORIUM, LAB, MEDICAL
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'building_code': self.building_code,
            'node_id': self.node_id,
            'node_name': self.node.name if self.node else None,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'capacity': self.capacity,
            'type': self.type,
            'description': self.description,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    def __repr__(self):
        return f"<Building {self.building_code}: {self.name}>"


class Path(db.Model):
    __tablename__ = 'paths'

    id = db.Column(db.Integer, primary_key=True)
    source_node_id = db.Column(db.Integer, db.ForeignKey('nodes.id', ondelete='CASCADE'), nullable=False)
    destination_node_id = db.Column(db.Integer, db.ForeignKey('nodes.id', ondelete='CASCADE'), nullable=False)
    distance_meters = db.Column(db.Float, nullable=False)
    capacity = db.Column(db.Integer, nullable=False, default=150)  # Max persons throughput per min
    current_crowd = db.Column(db.Integer, nullable=False, default=0)
    status = db.Column(db.String(20), nullable=False, default='OPEN')  # OPEN, BLOCKED, CONGESTED
    is_bidirectional = db.Column(db.Boolean, default=True)
    emergency_safe = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    @staticmethod
    def calculate_haversine_distance(lat1, lon1, lat2, lon2):
        """Calculates geographic distance in meters between two lat/lon pairs."""
        R = 6371000  # Radius of Earth in meters
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)

        a = math.sin(delta_phi / 2.0) ** 2 + \
            math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return round(R * c, 2)

    def to_dict(self):
        return {
            'id': self.id,
            'source_node_id': self.source_node_id,
            'source_node_name': self.source_node.name if self.source_node else None,
            'source_coordinates': [self.source_node.latitude, self.source_node.longitude] if self.source_node else None,
            'destination_node_id': self.destination_node_id,
            'destination_node_name': self.destination_node.name if self.destination_node else None,
            'destination_coordinates': [self.destination_node.latitude, self.destination_node.longitude] if self.destination_node else None,
            'distance_meters': self.distance_meters,
            'capacity': self.capacity,
            'current_crowd': self.current_crowd,
            'status': self.status,
            'is_bidirectional': self.is_bidirectional,
            'emergency_safe': self.emergency_safe,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    def __repr__(self):
        return f"<Path {self.id}: Node {self.source_node_id} -> Node {self.destination_node_id} ({self.status})>"


class Exit(db.Model):
    __tablename__ = 'exits'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    node_id = db.Column(db.Integer, db.ForeignKey('nodes.id', ondelete='CASCADE'), nullable=False)
    capacity = db.Column(db.Integer, nullable=False, default=500)  # Evacuation capacity people/min
    current_evacuation_load = db.Column(db.Integer, nullable=False, default=0)
    status = db.Column(db.String(20), nullable=False, default='ACTIVE')  # ACTIVE, BLOCKED
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'node_id': self.node_id,
            'node_name': self.node.name if self.node else None,
            'latitude': self.node.latitude if self.node else None,
            'longitude': self.node.longitude if self.node else None,
            'capacity': self.capacity,
            'current_evacuation_load': self.current_evacuation_load,
            'status': self.status,
            'description': self.description,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    def __repr__(self):
        return f"<Exit {self.id}: {self.name} [{self.status}]>"
