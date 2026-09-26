import os
import sys

# Ensure root directory is on Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.app import create_app
from backend.extensions import db
from backend.models.user import User

def seed_default_users():
    """Seeds default Admin and Student users into the database if not present."""
    default_users = [
        {
            "name": "Campus Safety Admin",
            "email": "admin@campus.edu",
            "password": "Admin@123",
            "role": "ADMIN"
        },
        {
            "name": "Alex Student",
            "email": "student@campus.edu",
            "password": "Student@123",
            "role": "STUDENT"
        }
    ]

    try:
        for user_data in default_users:
            existing = User.query.filter_by(email=user_data["email"]).first()
            if not existing:
                user = User(
                    name=user_data["name"],
                    email=user_data["email"],
                    role=user_data["role"]
                )
                user.set_password(user_data["password"])
                db.session.add(user)
                print(f" [+] Created user: {user.email} [{user.role}]")
            else:
                # Ensure password matches if needed
                if not existing.check_password(user_data["password"]):
                    existing.set_password(user_data["password"])
                    print(f" [*] Updated password for user: {existing.email}")
        db.session.commit()
        print("Database seeding completed successfully.")
    except Exception as e:
        db.session.rollback()
        print(f" [!] User seeding exception: {e}")

if __name__ == '__main__':
    app = create_app('development')
    with app.app_context():
        db.create_all()
        seed_default_users()
