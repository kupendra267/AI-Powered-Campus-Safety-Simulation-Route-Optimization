import re
from flask_jwt_extended import create_access_token
from backend.extensions import db
from backend.models.user import User

EMAIL_REGEX = re.compile(r"^[\w\.-]+@[\w\.-]+\.\w+$")

class AuthService:
    @staticmethod
    def validate_registration_input(name, email, password, role="STUDENT"):
        errors = []
        if not name or not name.strip():
            errors.append("Name is required.")
        elif len(name.strip()) < 2:
            errors.append("Name must be at least 2 characters.")

        if not email or not email.strip():
            errors.append("Email is required.")
        elif not EMAIL_REGEX.match(email.strip()):
            errors.append("Invalid email address format.")

        if not password:
            errors.append("Password is required.")
        elif len(password) < 6:
            errors.append("Password must be at least 6 characters.")

        allowed_roles = ["STUDENT", "ADMIN"]
        if role and role.upper() not in allowed_roles:
            errors.append(f"Invalid role. Allowed roles: {', '.join(allowed_roles)}.")

        return errors

    @staticmethod
    def register(name, email, password, role="STUDENT"):
        name = name.strip() if name else ""
        email = email.strip().lower() if email else ""
        role = role.strip().upper() if role else "STUDENT"

        errors = AuthService.validate_registration_input(name, email, password, role)
        if errors:
            return {"success": False, "error": "VALIDATION_ERROR", "message": errors[0], "details": errors}, 400

        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            return {"success": False, "error": "DUPLICATE_EMAIL", "message": "Email is already registered."}, 409

        new_user = User(name=name, email=email, role=role)
        new_user.set_password(password)

        try:
            db.session.add(new_user)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            return {"success": False, "error": "DATABASE_ERROR", "message": f"Failed to register user: {str(e)}"}, 500

        # Create JWT token with identity as stringified id and role in claims
        additional_claims = {
            "role": new_user.role,
            "email": new_user.email,
            "name": new_user.name
        }
        access_token = create_access_token(
            identity=str(new_user.id),
            additional_claims=additional_claims
        )

        return {
            "success": True,
            "message": "User registered successfully.",
            "data": {
                "user": new_user.to_dict(),
                "access_token": access_token
            }
        }, 201

    @staticmethod
    def login(email, password):
        if not email or not email.strip() or not password:
            return {"success": False, "error": "MISSING_CREDENTIALS", "message": "Email and password are required."}, 400

        email = email.strip().lower()
        
        user = None
        try:
            user = User.query.filter_by(email=email).first()
            if not user and email in ['admin@campus.edu', 'student@campus.edu']:
                from backend.seed.seed_users import seed_default_users
                seed_default_users()
                user = User.query.filter_by(email=email).first()
        except Exception:
            db.session.rollback()
            try:
                db.create_all()
                from backend.seed.seed_users import seed_default_users
                seed_default_users()
                user = User.query.filter_by(email=email).first()
            except Exception:
                db.session.rollback()
                user = None

        if not user or not user.check_password(password):
            return {"success": False, "error": "INVALID_CREDENTIALS", "message": "Invalid email or password."}, 401

        additional_claims = {
            "role": user.role,
            "email": user.email,
            "name": user.name
        }
        access_token = create_access_token(
            identity=str(user.id),
            additional_claims=additional_claims
        )

        return {
            "success": True,
            "message": "Login successful.",
            "data": {
                "user": user.to_dict(),
                "access_token": access_token
            }
        }, 200

    @staticmethod
    def get_user_profile(user_id):
        try:
            user = db.session.get(User, int(user_id))
            if not user:
                return {"success": False, "error": "USER_NOT_FOUND", "message": "User not found."}, 404
            return {"success": True, "data": {"user": user.to_dict()}}, 200
        except Exception as e:
            return {"success": False, "error": "SERVER_ERROR", "message": str(e)}, 500
