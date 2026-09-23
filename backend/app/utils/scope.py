# Roles that can own/manage an estate record. Estate developers use "estate_manager".
# Individual sellers (a homeowner listing their own single house/plot, per the
# "Individual Landowner" onboarding path) keep their buyer/public_user account
# role — they aren't relabeled as estate managers — but they own exactly the same
# kind of estate/property row for their one listing, so every ownership check
# here treats those two roles the same way estate_manager is treated.
ESTATE_OWNER_ROLES = ("estate_manager", "buyer", "public_user")


def can_manage_estate(user, estate):
    if user["role"] in ("admin", "super_admin"):
        return True
    return user["role"] in ESTATE_OWNER_ROLES and estate.get("manager_user_id") == user["id"]


def get_user_estate_ids(cursor, user):
    if user["role"] in ("admin", "super_admin"):
        return None

    if user["role"] in ESTATE_OWNER_ROLES:
        cursor.execute("SELECT id FROM estates WHERE manager_user_id = %s", (user["id"],))
        return {row["id"] for row in cursor.fetchall()}

    if user["role"] == "resident":
        cursor.execute("SELECT estate_id FROM residents WHERE user_id = %s AND status IN ('verified', 'active')", (user["id"],))
        return {row["estate_id"] for row in cursor.fetchall()}

    if user["role"] == "security":
        cursor.execute(
            "SELECT estate_id FROM security_assignments WHERE user_id = %s AND status = 'active'",
            (user["id"],),
        )
        return {row["estate_id"] for row in cursor.fetchall()}

    return set()


def can_access_estate(cursor, user, estate_id):
    estate_ids = get_user_estate_ids(cursor, user)
    return estate_ids is None or estate_id in estate_ids


def can_access_gate(cursor, user, estate_id, gate_name=None):
    if user["role"] in ("admin", "super_admin", "estate_manager"):
        return can_access_estate(cursor, user, estate_id)
    if user["role"] != "security":
        return False

    if gate_name:
        cursor.execute(
            """
            SELECT id FROM security_assignments
            WHERE user_id = %s AND estate_id = %s AND status = 'active'
              AND (gate_name IS NULL OR gate_name = %s)
            LIMIT 1
            """,
            (user["id"], estate_id, gate_name),
        )
    else:
        cursor.execute(
            """
            SELECT id FROM security_assignments
            WHERE user_id = %s AND estate_id = %s AND status = 'active'
            LIMIT 1
            """,
            (user["id"], estate_id),
        )
    return bool(cursor.fetchone())


GROUP_KEYS = ("all_residents", "estate_managers", "security_team", "maintenance")


def can_access_group(cursor, user, estate_id, group_key):
    """
    Community groups have no stored membership list — access is computed from
    role + live estate assignment, same source of truth as get_user_estate_ids().
    Admin/super_admin can always view/post (platform oversight). Estate managers
    can access every group for estates they manage (staff coordination).
    """
    if group_key not in GROUP_KEYS:
        return False
    if user["role"] in ("admin", "super_admin"):
        return True
    if not can_access_estate(cursor, user, estate_id):
        return False

    if user["role"] == "estate_manager":
        return True
    if group_key == "all_residents":
        return user["role"] == "resident"
    if group_key == "security_team":
        return user["role"] == "security"
    # 'maintenance' and any other staff-coordination group: estate manager/admin
    # only among non-estate-manager roles that reached this point.
    return False


def resident_can_access_property(cursor, user, property_id):
    if user["role"] in ("admin", "super_admin"):
        return True
    cursor.execute(
        """
        SELECT id FROM residents
        WHERE user_id = %s AND property_id = %s AND status IN ('verified', 'active')
        LIMIT 1
        """,
        (user["id"], property_id),
    )
    return bool(cursor.fetchone())
