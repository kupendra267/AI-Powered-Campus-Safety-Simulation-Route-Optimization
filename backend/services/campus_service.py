from backend.extensions import db
from backend.models.campus import Building, Node, Path, Exit
from backend.algorithms.graph_builder import CampusGraphBuilder

class CampusService:
    # ==================== BUILDINGS ====================
    @staticmethod
    def get_all_buildings():
        buildings = Building.query.order_by(Building.name).all()
        return [b.to_dict() for b in buildings]

    @staticmethod
    def get_building_by_id(building_id):
        return db.session.get(Building, int(building_id))

    @staticmethod
    def create_building(data):
        name = data.get('name', '').strip()
        building_code = data.get('building_code', '').strip().upper()
        node_id = data.get('node_id')
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        capacity = data.get('capacity', 500)
        building_type = data.get('type', 'ACADEMIC').strip().upper()
        description = data.get('description', '')

        if not name or not building_code or not node_id:
            return {"success": False, "message": "Name, building_code, and node_id are required."}, 400

        # Check existing code
        if Building.query.filter_by(building_code=building_code).first():
            return {"success": False, "message": f"Building code '{building_code}' already exists."}, 409

        node = db.session.get(Node, int(node_id))
        if not node:
            return {"success": False, "message": "Specified node_id does not exist."}, 404

        # If lat/lon not provided, inherit from node
        if latitude is None:
            latitude = node.latitude
        if longitude is None:
            longitude = node.longitude

        new_building = Building(
            name=name,
            building_code=building_code,
            node_id=int(node_id),
            latitude=float(latitude),
            longitude=float(longitude),
            capacity=int(capacity),
            type=building_type,
            description=description
        )
        db.session.add(new_building)
        db.session.commit()
        return {"success": True, "message": "Building created successfully.", "data": new_building.to_dict()}, 201

    @staticmethod
    def update_building(building_id, data):
        building = db.session.get(Building, int(building_id))
        if not building:
            return {"success": False, "message": "Building not found."}, 404

        if 'name' in data and data['name']:
            building.name = data['name'].strip()
        if 'building_code' in data and data['building_code']:
            code = data['building_code'].strip().upper()
            existing = Building.query.filter_by(building_code=code).first()
            if existing and existing.id != building.id:
                return {"success": False, "message": f"Building code '{code}' already taken."}, 409
            building.building_code = code
        if 'node_id' in data and data['node_id']:
            node = db.session.get(Node, int(data['node_id']))
            if not node:
                return {"success": False, "message": "Specified node_id does not exist."}, 404
            building.node_id = int(data['node_id'])
        if 'latitude' in data and data['latitude'] is not None:
            building.latitude = float(data['latitude'])
        if 'longitude' in data and data['longitude'] is not None:
            building.longitude = float(data['longitude'])
        if 'capacity' in data and data['capacity'] is not None:
            building.capacity = int(data['capacity'])
        if 'type' in data and data['type']:
            building.type = data['type'].strip().upper()
        if 'description' in data:
            building.description = data['description']

        db.session.commit()
        return {"success": True, "message": "Building updated successfully.", "data": building.to_dict()}, 200

    @staticmethod
    def delete_building(building_id):
        building = db.session.get(Building, int(building_id))
        if not building:
            return {"success": False, "message": "Building not found."}, 404

        db.session.delete(building)
        db.session.commit()
        return {"success": True, "message": "Building deleted successfully."}, 200

    # ==================== NODES ====================
    @staticmethod
    def get_all_nodes():
        nodes = Node.query.order_by(Node.id).all()
        return [n.to_dict() for n in nodes]

    @staticmethod
    def get_node_by_id(node_id):
        return db.session.get(Node, int(node_id))

    @staticmethod
    def create_node(data):
        name = data.get('name', '').strip()
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        node_type = data.get('node_type', 'JUNCTION').strip().upper()

        if not name or latitude is None or longitude is None:
            return {"success": False, "message": "Name, latitude, and longitude are required."}, 400

        new_node = Node(
            name=name,
            latitude=float(latitude),
            longitude=float(longitude),
            node_type=node_type
        )
        db.session.add(new_node)
        db.session.commit()
        return {"success": True, "message": "Node created successfully.", "data": new_node.to_dict()}, 201

    @staticmethod
    def update_node(node_id, data):
        node = db.session.get(Node, int(node_id))
        if not node:
            return {"success": False, "message": "Node not found."}, 404

        if 'name' in data and data['name']:
            node.name = data['name'].strip()
        if 'latitude' in data and data['latitude'] is not None:
            node.latitude = float(data['latitude'])
        if 'longitude' in data and data['longitude'] is not None:
            node.longitude = float(data['longitude'])
        if 'node_type' in data and data['node_type']:
            node.node_type = data['node_type'].strip().upper()

        db.session.commit()
        return {"success": True, "message": "Node updated successfully.", "data": node.to_dict()}, 200

    @staticmethod
    def delete_node(node_id):
        node = db.session.get(Node, int(node_id))
        if not node:
            return {"success": False, "message": "Node not found."}, 404

        db.session.delete(node)
        db.session.commit()
        return {"success": True, "message": "Node and all connected paths/buildings deleted successfully."}, 200

    # ==================== PATHS ====================
    @staticmethod
    def get_all_paths():
        paths = Path.query.order_by(Path.id).all()
        return [p.to_dict() for p in paths]

    @staticmethod
    def get_path_by_id(path_id):
        return db.session.get(Path, int(path_id))

    @staticmethod
    def create_path(data):
        src_id = data.get('source_node_id')
        dest_id = data.get('destination_node_id')
        distance = data.get('distance_meters')
        capacity = data.get('capacity', 150)
        status = data.get('status', 'OPEN').strip().upper()
        is_bidirectional = data.get('is_bidirectional', True)
        emergency_safe = data.get('emergency_safe', True)

        if not src_id or not dest_id:
            return {"success": False, "message": "source_node_id and destination_node_id are required."}, 400

        if int(src_id) == int(dest_id):
            return {"success": False, "message": "Source and destination nodes cannot be the same."}, 400

        src_node = db.session.get(Node, int(src_id))
        dest_node = db.session.get(Node, int(dest_id))
        if not src_node or not dest_node:
            return {"success": False, "message": "Source or destination node does not exist."}, 404

        # Calculate distance automatically if not specified
        if distance is None or float(distance) <= 0:
            distance = Path.calculate_haversine_distance(
                src_node.latitude, src_node.longitude,
                dest_node.latitude, dest_node.longitude
            )

        new_path = Path(
            source_node_id=int(src_id),
            destination_node_id=int(dest_id),
            distance_meters=float(distance),
            capacity=int(capacity),
            status=status,
            is_bidirectional=bool(is_bidirectional),
            emergency_safe=bool(emergency_safe)
        )
        db.session.add(new_path)
        db.session.commit()
        return {"success": True, "message": "Path created successfully.", "data": new_path.to_dict()}, 201

    @staticmethod
    def update_path(path_id, data):
        path = db.session.get(Path, int(path_id))
        if not path:
            return {"success": False, "message": "Path not found."}, 404

        if 'source_node_id' in data and data['source_node_id']:
            src = db.session.get(Node, int(data['source_node_id']))
            if not src:
                return {"success": False, "message": "Source node not found."}, 404
            path.source_node_id = int(data['source_node_id'])

        if 'destination_node_id' in data and data['destination_node_id']:
            dest = db.session.get(Node, int(data['destination_node_id']))
            if not dest:
                return {"success": False, "message": "Destination node not found."}, 404
            path.destination_node_id = int(data['destination_node_id'])

        if 'distance_meters' in data and data['distance_meters'] is not None:
            path.distance_meters = float(data['distance_meters'])
        if 'capacity' in data and data['capacity'] is not None:
            path.capacity = int(data['capacity'])
        if 'current_crowd' in data and data['current_crowd'] is not None:
            path.current_crowd = int(data['current_crowd'])
        if 'status' in data and data['status']:
            path.status = data['status'].strip().upper()
        if 'is_bidirectional' in data:
            path.is_bidirectional = bool(data['is_bidirectional'])
        if 'emergency_safe' in data:
            path.emergency_safe = bool(data['emergency_safe'])

        db.session.commit()
        return {"success": True, "message": "Path updated successfully.", "data": path.to_dict()}, 200

    @staticmethod
    def toggle_path_status(path_id):
        path = db.session.get(Path, int(path_id))
        if not path:
            return {"success": False, "message": "Path not found."}, 404

        path.status = 'BLOCKED' if path.status == 'OPEN' else 'OPEN'
        db.session.commit()
        return {
            "success": True,
            "message": f"Path status toggled to {path.status}.",
            "data": path.to_dict()
        }, 200

    @staticmethod
    def delete_path(path_id):
        path = db.session.get(Path, int(path_id))
        if not path:
            return {"success": False, "message": "Path not found."}, 404

        db.session.delete(path)
        db.session.commit()
        return {"success": True, "message": "Path deleted successfully."}, 200

    # ==================== EXITS ====================
    @staticmethod
    def get_all_exits():
        exits = Exit.query.order_by(Exit.id).all()
        return [e.to_dict() for e in exits]

    @staticmethod
    def get_exit_by_id(exit_id):
        return db.session.get(Exit, int(exit_id))

    @staticmethod
    def create_exit(data):
        name = data.get('name', '').strip()
        node_id = data.get('node_id')
        capacity = data.get('capacity', 500)
        status = data.get('status', 'ACTIVE').strip().upper()
        description = data.get('description', '')

        if not name or not node_id:
            return {"success": False, "message": "Name and node_id are required."}, 400

        node = db.session.get(Node, int(node_id))
        if not node:
            return {"success": False, "message": "Specified node_id does not exist."}, 404

        # Update node_type to EXIT if not already
        node.node_type = 'EXIT'

        new_exit = Exit(
            name=name,
            node_id=int(node_id),
            capacity=int(capacity),
            status=status,
            description=description
        )
        db.session.add(new_exit)
        db.session.commit()
        return {"success": True, "message": "Exit created successfully.", "data": new_exit.to_dict()}, 201

    @staticmethod
    def update_exit(exit_id, data):
        exit_obj = db.session.get(Exit, int(exit_id))
        if not exit_obj:
            return {"success": False, "message": "Exit not found."}, 404

        if 'name' in data and data['name']:
            exit_obj.name = data['name'].strip()
        if 'node_id' in data and data['node_id']:
            node = db.session.get(Node, int(data['node_id']))
            if not node:
                return {"success": False, "message": "Specified node does not exist."}, 404
            exit_obj.node_id = int(data['node_id'])
            node.node_type = 'EXIT'
        if 'capacity' in data and data['capacity'] is not None:
            exit_obj.capacity = int(data['capacity'])
        if 'status' in data and data['status']:
            exit_obj.status = data['status'].strip().upper()
        if 'description' in data:
            exit_obj.description = data['description']

        db.session.commit()
        return {"success": True, "message": "Exit updated successfully.", "data": exit_obj.to_dict()}, 200

    @staticmethod
    def delete_exit(exit_id):
        exit_obj = db.session.get(Exit, int(exit_id))
        if not exit_obj:
            return {"success": False, "message": "Exit not found."}, 404

        db.session.delete(exit_obj)
        db.session.commit()
        return {"success": True, "message": "Exit deleted successfully."}, 200

    # ==================== GRAPH TOPOLOGY ====================
    @staticmethod
    def get_campus_graph():
        return CampusGraphBuilder.build_graph_dict()
