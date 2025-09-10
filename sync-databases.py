#!/usr/bin/env python3
"""
Database Synchronization Utility
Sync data between production and beta databases
"""
import sqlite3
import shutil
import os
import sys
from datetime import datetime

MAIN_DB = "inventory.db"
PROD_DB = "inventory-production.db"
BETA_DB = "inventory-beta.db"

def backup_database(db_file):
    """Create a backup of a database"""
    if not os.path.exists(db_file):
        return None
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = f"{db_file}.backup_{timestamp}"
    shutil.copy2(db_file, backup_file)
    return backup_file

def get_table_counts(db_file):
    """Get record counts from database tables"""
    if not os.path.exists(db_file):
        return None
    
    try:
        conn = sqlite3.connect(db_file)
        cursor = conn.cursor()
        
        counts = {}
        for table in ['items', 'users', 'checkoutHistory']:
            cursor.execute(f'SELECT COUNT(*) FROM {table}')
            counts[table] = cursor.fetchone()[0]
        
        conn.close()
        return counts
    except Exception as e:
        print(f"❌ Error reading {db_file}: {e}")
        return None

def show_status():
    """Show current database status"""
    print("📊 Database Status")
    print("=" * 50)
    
    for db_name, db_file in [
        ("Main Database", MAIN_DB),
        ("Production Database", PROD_DB),
        ("Beta Database", BETA_DB)
    ]:
        print(f"\n{db_name}: {db_file}")
        
        if os.path.exists(db_file):
            size = os.path.getsize(db_file)
            modified = datetime.fromtimestamp(os.path.getmtime(db_file))
            counts = get_table_counts(db_file)
            
            print(f"  ✅ Exists ({size:,} bytes)")
            print(f"  📅 Modified: {modified.strftime('%Y-%m-%d %H:%M:%S')}")
            
            if counts:
                print(f"  📦 Items: {counts['items']}")
                print(f"  👥 Users: {counts['users']}")
                print(f"  📋 Checkout History: {counts['checkoutHistory']}")
        else:
            print("  ❌ Does not exist")

def sync_prod_to_beta():
    """Sync production database to beta"""
    print("\n🔄 Syncing Production → Beta")
    
    if not os.path.exists(PROD_DB):
        print(f"❌ Production database not found: {PROD_DB}")
        return False
    
    # Backup beta database
    if os.path.exists(BETA_DB):
        backup = backup_database(BETA_DB)
        if backup:
            print(f"📄 Beta backup created: {backup}")
    
    # Copy production to beta
    try:
        shutil.copy2(PROD_DB, BETA_DB)
        print(f"✅ Production data synced to beta")
        return True
    except Exception as e:
        print(f"❌ Sync failed: {e}")
        return False

def sync_beta_to_prod():
    """Sync beta database to production"""
    print("\n🔄 Syncing Beta → Production")
    
    if not os.path.exists(BETA_DB):
        print(f"❌ Beta database not found: {BETA_DB}")
        return False
    
    print("⚠️  WARNING: This will overwrite production data!")
    confirm = input("Type 'yes' to confirm: ").strip().lower()
    
    if confirm != 'yes':
        print("❌ Sync cancelled")
        return False
    
    # Backup production database
    if os.path.exists(PROD_DB):
        backup = backup_database(PROD_DB)
        if backup:
            print(f"📄 Production backup created: {backup}")
    
    # Copy beta to production
    try:
        shutil.copy2(BETA_DB, PROD_DB)
        print(f"✅ Beta data synced to production")
        return True
    except Exception as e:
        print(f"❌ Sync failed: {e}")
        return False

def sync_main_to_prod():
    """Sync main database to production"""
    print("\n🔄 Syncing Main → Production")
    
    if not os.path.exists(MAIN_DB):
        print(f"❌ Main database not found: {MAIN_DB}")
        return False
    
    # Backup production database
    if os.path.exists(PROD_DB):
        backup = backup_database(PROD_DB)
        if backup:
            print(f"📄 Production backup created: {backup}")
    
    # Copy main to production
    try:
        shutil.copy2(MAIN_DB, PROD_DB)
        print(f"✅ Main data synced to production")
        return True
    except Exception as e:
        print(f"❌ Sync failed: {e}")
        return False

def sync_main_to_beta():
    """Sync main database to beta"""
    print("\n🔄 Syncing Main → Beta")
    
    if not os.path.exists(MAIN_DB):
        print(f"❌ Main database not found: {MAIN_DB}")
        return False
    
    # Backup beta database
    if os.path.exists(BETA_DB):
        backup = backup_database(BETA_DB)
        if backup:
            print(f"📄 Beta backup created: {backup}")
    
    # Copy main to beta
    try:
        shutil.copy2(MAIN_DB, BETA_DB)
        print(f"✅ Main data synced to beta")
        return True
    except Exception as e:
        print(f"❌ Sync failed: {e}")
        return False

def show_menu():
    """Show sync menu"""
    print("\n🔄 Database Sync Menu")
    print("=" * 30)
    print("1. Show Status")
    print("2. Sync Production → Beta")
    print("3. Sync Beta → Production (DANGEROUS)")
    print("4. Sync Main → Production")
    print("5. Sync Main → Beta")
    print("6. Exit")
    print()
    return input("Choose option (1-6): ").strip()

def main():
    """Main sync utility"""
    print("🗄️  Database Synchronization Utility")
    
    while True:
        choice = show_menu()
        
        if choice == '1':
            show_status()
        elif choice == '2':
            sync_prod_to_beta()
        elif choice == '3':
            sync_beta_to_prod()
        elif choice == '4':
            sync_main_to_prod()
        elif choice == '5':
            sync_main_to_beta()
        elif choice == '6':
            print("👋 Goodbye!")
            break
        else:
            print("❌ Invalid choice")
        
        if choice != '1':
            input("\nPress Enter to continue...")

if __name__ == "__main__":
    main()