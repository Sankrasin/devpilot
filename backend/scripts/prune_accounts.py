import sys
import os
from datetime import datetime, timedelta, timezone

# Add backend directory to path so we can import from database and models
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models import User, Workspace

def prune_inactive_accounts():
    """
    Deletes all users and their associated workspaces if they have not
    been active in the last 30 days. This ensures the database remains free.
    """
    db = SessionLocal()
    try:
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
        
        # Find inactive users
        inactive_users = db.query(User).filter(User.last_active < thirty_days_ago).all()
        
        if not inactive_users:
            print("No inactive accounts found. Database is clean.")
            return

        print(f"Found {len(inactive_users)} inactive account(s) to prune.")
        
        for user in inactive_users:
            print(f"Deleting user {user.email} (Last active: {user.last_active})...")
            # Workspaces have a foreign key to user_id. 
            # In SQLAlchemy we usually set cascade="all, delete" on the relationship.
            # If not explicitly set, we can delete manually here.
            db.query(Workspace).filter(Workspace.user_id == user.id).delete()
            db.delete(user)
            
        db.commit()
        print("Successfully pruned all inactive accounts and their workspaces.")
        
    except Exception as e:
        print(f"An error occurred during pruning: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    prune_inactive_accounts()
