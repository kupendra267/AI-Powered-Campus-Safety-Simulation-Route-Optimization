from backend.models.campus import Node, Path, Exit, Building

class CampusGraphBuilder:
    @staticmethod
    def build_graph_dict():
        """
        Builds a comprehensive adjacency list and graph topology structure
        representing the campus network directly from the database.
        """
        nodes = Node.query.all()
        paths = Path.query.all()
        buildings = Building.query.all()
        exits = Exit.query.all()

        nodes_map = {node.id: node.to_dict() for node in nodes}
        adjacency = {node.id: [] for node in nodes}

        edges = []
        for path in paths:
            edge_data = path.to_dict()
            edges.append(edge_data)

            # Build outgoing edge for source -> destination
            adjacency[path.source_node_id].append({
                'path_id': path.id,
                'target_node_id': path.destination_node_id,
                'target_node_name': nodes_map.get(path.destination_node_id, {}).get('name'),
                'distance_meters': path.distance_meters,
                'capacity': path.capacity,
                'current_crowd': path.current_crowd,
                'status': path.status,
                'emergency_safe': path.emergency_safe
            })

            # If bidirectional, build destination -> source
            if path.is_bidirectional and path.destination_node_id in adjacency:
                adjacency[path.destination_node_id].append({
                    'path_id': path.id,
                    'target_node_id': path.source_node_id,
                    'target_node_name': nodes_map.get(path.source_node_id, {}).get('name'),
                    'distance_meters': path.distance_meters,
                    'capacity': path.capacity,
                    'current_crowd': path.current_crowd,
                    'status': path.status,
                    'emergency_safe': path.emergency_safe
                })

        return {
            'nodes': [node.to_dict() for node in nodes],
            'edges': edges,
            'adjacency': adjacency,
            'buildings': [b.to_dict() for b in buildings],
            'exits': [e.to_dict() for e in exits],
            'summary': {
                'total_nodes': len(nodes),
                'total_paths': len(paths),
                'total_buildings': len(buildings),
                'total_exits': len(exits),
                'blocked_paths': sum(1 for p in paths if p.status == 'BLOCKED')
            }
        }
