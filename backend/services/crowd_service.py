import random
from datetime import datetime, timezone, timedelta
from sqlalchemy import func, desc
from backend.extensions import db
from backend.models.campus import Building, Node
from backend.models.crowd import CrowdData, SystemAlert

class CrowdService:
    @staticmethod
    def create_crowd_record(data):
        location_id = data.get('location_id')
        crowd_count = data.get('crowd_count')
        capacity = data.get('capacity')
        timestamp_str = data.get('timestamp')
        source = data.get('source', 'MANUAL_ENTRY')

        if not location_id:
            return {"success": False, "message": "location_id is required."}, 400

        building = db.session.get(Building, int(location_id))
        if not building:
            return {"success": False, "message": f"Building with id {location_id} not found."}, 404

        if crowd_count is None:
            return {"success": False, "message": "crowd_count is required."}, 400

        try:
            crowd_count = int(crowd_count)
            if crowd_count < 0:
                return {"success": False, "message": "crowd_count cannot be negative."}, 400
        except ValueError:
            return {"success": False, "message": "crowd_count must be an integer."}, 400

        if not capacity:
            capacity = building.capacity
        else:
            try:
                capacity = int(capacity)
                if capacity <= 0:
                    return {"success": False, "message": "capacity must be greater than zero."}, 400
            except ValueError:
                return {"success": False, "message": "capacity must be an integer."}, 400

        # Parse timestamp if provided
        record_time = datetime.now(timezone.utc)
        if timestamp_str:
            try:
                record_time = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
            except Exception:
                pass

        density, congestion = CrowdData.compute_density_and_congestion(crowd_count, capacity)

        record = CrowdData(
            location_id=int(location_id),
            timestamp=record_time,
            crowd_count=crowd_count,
            capacity=capacity,
            density_percentage=density,
            congestion_level=congestion,
            source=source
        )
        db.session.add(record)

        # Trigger Automated Alert on HIGH or CRITICAL
        if congestion in ['HIGH', 'CRITICAL']:
            severity = 'DANGER' if congestion == 'CRITICAL' else 'WARNING'
            alert_title = f"{congestion} Congestion: {building.name}"
            alert_msg = f"Crowd density reached {density}% ({crowd_count}/{capacity} people) at {building.name}."
            alert = SystemAlert(
                title=alert_title,
                message=alert_msg,
                alert_type='CONGESTION',
                severity=severity,
                related_location_id=building.id
            )
            db.session.add(alert)

        db.session.commit()
        return {"success": True, "message": "Crowd record created successfully.", "data": record.to_dict()}, 201

    @staticmethod
    def get_crowd_records(location_id=None, congestion_level=None, start_date=None, end_date=None, page=1, limit=50):
        query = CrowdData.query

        if location_id:
            query = query.filter(CrowdData.location_id == int(location_id))

        if congestion_level and congestion_level != 'ALL':
            query = query.filter(CrowdData.congestion_level == congestion_level.upper())

        if start_date:
            try:
                st = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                query = query.filter(CrowdData.timestamp >= st)
            except Exception:
                pass

        if end_date:
            try:
                et = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                query = query.filter(CrowdData.timestamp <= et)
            except Exception:
                pass

        total_records = query.count()
        records = query.order_by(desc(CrowdData.timestamp)).paginate(page=page, per_page=limit, error_out=False)

        return {
            "success": True,
            "data": [r.to_dict() for r in records.items],
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_records,
                "pages": records.pages
            }
        }, 200

    @staticmethod
    def get_crowd_record_by_id(record_id):
        record = db.session.get(CrowdData, int(record_id))
        if not record:
            return {"success": False, "message": "Crowd record not found."}, 404
        return {"success": True, "data": record.to_dict()}, 200

    @staticmethod
    def update_crowd_record(record_id, data):
        record = db.session.get(CrowdData, int(record_id))
        if not record:
            return {"success": False, "message": "Crowd record not found."}, 404

        if 'crowd_count' in data and data['crowd_count'] is not None:
            count = int(data['crowd_count'])
            if count < 0:
                return {"success": False, "message": "crowd_count cannot be negative."}, 400
            record.crowd_count = count

        if 'capacity' in data and data['capacity'] is not None:
            cap = int(data['capacity'])
            if cap <= 0:
                return {"success": False, "message": "capacity must be greater than zero."}, 400
            record.capacity = cap

        if 'source' in data and data['source']:
            record.source = data['source']

        density, congestion = CrowdData.compute_density_and_congestion(record.crowd_count, record.capacity)
        record.density_percentage = density
        record.congestion_level = congestion

        db.session.commit()
        return {"success": True, "message": "Crowd record updated successfully.", "data": record.to_dict()}, 200

    @staticmethod
    def delete_crowd_record(record_id):
        record = db.session.get(CrowdData, int(record_id))
        if not record:
            return {"success": False, "message": "Crowd record not found."}, 404

        db.session.delete(record)
        db.session.commit()
        return {"success": True, "message": "Crowd record deleted successfully."}, 200

    @staticmethod
    def get_current_crowd():
        """
        Retrieves the most recent crowd record for every campus building.
        If a building has no records, initializes a realistic baseline record.
        """
        buildings = Building.query.all()
        current_data = []

        for b in buildings:
            latest = CrowdData.query.filter_by(location_id=b.id).order_by(desc(CrowdData.timestamp)).first()
            if latest:
                current_data.append(latest.to_dict())
            else:
                # Baseline default
                default_count = int(b.capacity * 0.25)
                density, congestion = CrowdData.compute_density_and_congestion(default_count, b.capacity)
                baseline = CrowdData(
                    location_id=b.id,
                    timestamp=datetime.now(timezone.utc),
                    crowd_count=default_count,
                    capacity=b.capacity,
                    density_percentage=density,
                    congestion_level=congestion,
                    source='SIMULATION'
                )
                db.session.add(baseline)
                db.session.commit()
                current_data.append(baseline.to_dict())

        return {"success": True, "data": current_data, "count": len(current_data)}, 200

    @staticmethod
    def get_crowd_summary():
        """
        Computes aggregate metrics across the latest current status of all buildings.
        """
        buildings = Building.query.all()
        if not buildings:
            return {
                "success": True,
                "data": {
                    "total_crowd": 0,
                    "total_capacity": 0,
                    "average_density": 0,
                    "max_density": 0,
                    "low_count": 0,
                    "medium_count": 0,
                    "high_count": 0,
                    "critical_count": 0,
                    "most_congested_location": None,
                    "active_alerts_count": 0
                }
            }, 200

        total_crowd = 0
        total_capacity = 0
        densities = []
        counts_by_level = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
        most_congested = None
        highest_density = -1.0

        for b in buildings:
            latest = CrowdData.query.filter_by(location_id=b.id).order_by(desc(CrowdData.timestamp)).first()
            if latest:
                total_crowd += latest.crowd_count
                total_capacity += latest.capacity
                densities.append(latest.density_percentage)
                counts_by_level[latest.congestion_level] = counts_by_level.get(latest.congestion_level, 0) + 1

                if latest.density_percentage > highest_density:
                    highest_density = latest.density_percentage
                    most_congested = {
                        "location_id": b.id,
                        "location_name": b.name,
                        "building_code": b.building_code,
                        "crowd_count": latest.crowd_count,
                        "capacity": latest.capacity,
                        "density_percentage": latest.density_percentage,
                        "congestion_level": latest.congestion_level
                    }

        avg_density = round(sum(densities) / len(densities), 2) if densities else 0.0
        max_density = max(densities) if densities else 0.0

        active_alerts_count = SystemAlert.query.filter_by(is_active=True).count()

        return {
            "success": True,
            "data": {
                "total_crowd": total_crowd,
                "total_capacity": total_capacity,
                "average_density": avg_density,
                "max_density": max_density,
                "low_count": counts_by_level["LOW"],
                "medium_count": counts_by_level["MEDIUM"],
                "high_count": counts_by_level["HIGH"],
                "critical_count": counts_by_level["CRITICAL"],
                "most_congested_location": most_congested,
                "active_alerts_count": active_alerts_count
            }
        }, 200

    @staticmethod
    def get_crowd_trends(days=1, location_id=None):
        """
        Generates structured data for Chart.js visualization.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        query = CrowdData.query.filter(CrowdData.timestamp >= cutoff)

        if location_id:
            query = query.filter(CrowdData.location_id == int(location_id))

        records = query.order_by(CrowdData.timestamp).all()

        # 1. Timeline series
        timeline_map = {}
        for r in records:
            hour_key = r.timestamp.strftime('%Y-%m-%d %H:00')
            if hour_key not in timeline_map:
                timeline_map[hour_key] = {"total_crowd": 0, "count": 0, "total_density": 0.0}
            timeline_map[hour_key]["total_crowd"] += r.crowd_count
            timeline_map[hour_key]["total_density"] += r.density_percentage
            timeline_map[hour_key]["count"] += 1

        timeline_labels = sorted(list(timeline_map.keys()))
        crowd_over_time = [
            timeline_map[k]["total_crowd"] for k in timeline_labels
        ]
        density_over_time = [
            round(timeline_map[k]["total_density"] / max(1, timeline_map[k]["count"]), 2)
            for k in timeline_labels
        ]

        # 2. Location comparison (Latest)
        buildings = Building.query.all()
        location_comparison = []
        for b in buildings:
            latest = CrowdData.query.filter_by(location_id=b.id).order_by(desc(CrowdData.timestamp)).first()
            if latest:
                location_comparison.append({
                    "location_name": b.name,
                    "building_code": b.building_code,
                    "crowd_count": latest.crowd_count,
                    "capacity": latest.capacity,
                    "density_percentage": latest.density_percentage,
                    "congestion_level": latest.congestion_level
                })

        # 3. Congestion breakdown
        breakdown = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
        for item in location_comparison:
            breakdown[item["congestion_level"]] = breakdown.get(item["congestion_level"], 0) + 1

        return {
            "success": True,
            "data": {
                "timeline_labels": [lbl.split(' ')[1] for lbl in timeline_labels] if len(timeline_labels) <= 24 else timeline_labels,
                "crowd_over_time": crowd_over_time,
                "density_over_time": density_over_time,
                "location_comparison": location_comparison,
                "congestion_breakdown": breakdown
            }
        }, 200

    @staticmethod
    def run_simulation_step(scenario='random'):
        """
        Executes a single simulation step across all campus facilities.
        Generates realistic crowd fluctuations based on scenario:
        - 'morning': Class arrivals (85% academic, low canteen)
        - 'lunch': High food court / canteen peak (85-95%)
        - 'evening': Departure surge (Hostels & Gates high, classrooms low)
        - 'random': Natural variations
        """
        buildings = Building.query.all()
        now = datetime.now(timezone.utc)
        updated_records = []

        for b in buildings:
            if scenario == 'lunch':
                if b.type == 'CANTEEN':
                    ratio = random.uniform(0.85, 0.98)  # Critical / High lunch rush!
                elif b.type in ['ACADEMIC', 'LAB']:
                    ratio = random.uniform(0.30, 0.45)
                elif b.type == 'LIBRARY':
                    ratio = random.uniform(0.50, 0.70)
                else:
                    ratio = random.uniform(0.20, 0.40)
            elif scenario == 'morning':
                if b.type in ['ACADEMIC', 'LAB', 'ADMIN']:
                    ratio = random.uniform(0.75, 0.92)  # Morning class peak
                elif b.type == 'CANTEEN':
                    ratio = random.uniform(0.20, 0.35)
                elif b.type == 'HOSTEL':
                    ratio = random.uniform(0.15, 0.30)
                else:
                    ratio = random.uniform(0.30, 0.50)
            elif scenario == 'evening':
                if b.type in ['HOSTEL', 'RECREATION', 'AUDITORIUM']:
                    ratio = random.uniform(0.70, 0.92)
                elif b.type in ['ACADEMIC', 'LAB', 'ADMIN']:
                    ratio = random.uniform(0.10, 0.25)
                elif b.type == 'CANTEEN':
                    ratio = random.uniform(0.60, 0.78)
                else:
                    ratio = random.uniform(0.30, 0.45)
            else: # Random slight drift
                latest = CrowdData.query.filter_by(location_id=b.id).order_by(desc(CrowdData.timestamp)).first()
                prev_ratio = (latest.crowd_count / latest.capacity) if latest else 0.4
                delta = random.uniform(-0.10, 0.10)
                ratio = max(0.10, min(0.96, prev_ratio + delta))

            count = int(b.capacity * ratio)
            density, congestion = CrowdData.compute_density_and_congestion(count, b.capacity)

            record = CrowdData(
                location_id=b.id,
                timestamp=now,
                crowd_count=count,
                capacity=b.capacity,
                density_percentage=density,
                congestion_level=congestion,
                source='SIMULATION'
            )
            db.session.add(record)
            updated_records.append(record)

            if congestion in ['HIGH', 'CRITICAL']:
                severity = 'DANGER' if congestion == 'CRITICAL' else 'WARNING'
                alert = SystemAlert(
                    title=f"{congestion} Congestion: {b.name}",
                    message=f"Simulation event: {b.name} reached {density}% capacity ({count}/{b.capacity} people).",
                    alert_type='CONGESTION',
                    severity=severity,
                    related_location_id=b.id
                )
                db.session.add(alert)

        db.session.commit()
        return {
            "success": True,
            "message": f"Simulation step executed successfully ({scenario.upper()} scenario).",
            "data": [r.to_dict() for r in updated_records]
        }, 200

    @staticmethod
    def reset_simulation():
        """
        Resets crowd density across all campus buildings to calm baseline (~25-35%).
        """
        buildings = Building.query.all()
        now = datetime.now(timezone.utc)
        records = []

        for b in buildings:
            count = int(b.capacity * random.uniform(0.20, 0.35))
            density, congestion = CrowdData.compute_density_and_congestion(count, b.capacity)
            r = CrowdData(
                location_id=b.id,
                timestamp=now,
                crowd_count=count,
                capacity=b.capacity,
                density_percentage=density,
                congestion_level='LOW',
                source='SIMULATION'
            )
            db.session.add(r)
            records.append(r)

        # Deactivate old congestion alerts
        SystemAlert.query.filter_by(alert_type='CONGESTION', is_active=True).update({'is_active': False})

        db.session.commit()
        return {"success": True, "message": "Simulation reset to baseline conditions.", "data": [r.to_dict() for r in records]}, 200

    @staticmethod
    def get_alerts(is_active=True, limit=20):
        query = SystemAlert.query
        if is_active is not None:
            query = query.filter_by(is_active=bool(is_active))
        alerts = query.order_by(desc(SystemAlert.created_at)).limit(limit).all()
        return {"success": True, "data": [a.to_dict() for a in alerts]}, 200

    @staticmethod
    def dismiss_alert(alert_id):
        alert = db.session.get(SystemAlert, int(alert_id))
        if not alert:
            return {"success": False, "message": "Alert not found."}, 404
        alert.is_active = False
        db.session.commit()
        return {"success": True, "message": "Alert dismissed.", "data": alert.to_dict()}, 200
