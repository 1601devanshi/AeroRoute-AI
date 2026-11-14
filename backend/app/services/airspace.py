
import math


EARTH_RADIUS_KM = 6371.0


def project_point(point, reference_lat):
    """
    Convert latitude/longitude into local kilometres.
    This is a local approximation for route intersection checks.
    """
    lat = math.radians(point["lat"])
    lon = math.radians(point["lon"])

    x = EARTH_RADIUS_KM * lon * math.cos(math.radians(reference_lat))
    y = EARTH_RADIUS_KM * lat

    return x, y


def orientation(a, b, c):
    return (
        (b[1] - a[1]) * (c[0] - b[0])
        - (b[0] - a[0]) * (c[1] - b[1])
    )


def on_segment(a, b, p):
    epsilon = 1e-9

    return (
        min(a[0], b[0]) - epsilon <= p[0] <= max(a[0], b[0]) + epsilon
        and min(a[1], b[1]) - epsilon <= p[1] <= max(a[1], b[1]) + epsilon
    )


def segments_intersect(a, b, c, d):
    """Check whether two line segments intersect."""
    o1 = orientation(a, b, c)
    o2 = orientation(a, b, d)
    o3 = orientation(c, d, a)
    o4 = orientation(c, d, b)

    if o1 * o2 < 0 and o3 * o4 < 0:
        return True

    epsilon = 1e-9

    if abs(o1) < epsilon and on_segment(a, b, c):
        return True

    if abs(o2) < epsilon and on_segment(a, b, d):
        return True

    if abs(o3) < epsilon and on_segment(c, d, a):
        return True

    if abs(o4) < epsilon and on_segment(c, d, b):
        return True

    return False


def point_in_polygon(point, polygon):
    """Ray-casting point-in-polygon test."""
    x, y = point
    inside = False

    j = len(polygon) - 1

    for i in range(len(polygon)):
        xi, yi = polygon[i]
        xj, yj = polygon[j]

        if (yi > y) != (yj > y):
            intersection_x = (
                (xj - xi) * (y - yi) / (yj - yi) + xi
            )

            if x < intersection_x:
                inside = not inside

        j = i

    return inside


def distance_point_to_segment(point, start, end):
    """Minimum 2D distance from a point to a line segment."""
    px, py = point
    ax, ay = start
    bx, by = end

    dx = bx - ax
    dy = by - ay

    length_squared = dx * dx + dy * dy

    if length_squared == 0:
        return math.hypot(px - ax, py - ay)

    t = (
        (px - ax) * dx + (py - ay) * dy
    ) / length_squared

    t = max(0.0, min(1.0, t))

    closest_x = ax + t * dx
    closest_y = ay + t * dy

    return math.hypot(px - closest_x, py - closest_y)


def segment_crosses_circle(start, end, zone):
    reference_lat = (start["lat"] + end["lat"]) / 2

    a = project_point(start, reference_lat)
    b = project_point(end, reference_lat)

    center = project_point(zone["center"], reference_lat)

    distance = distance_point_to_segment(center, a, b)

    return distance <= zone["radius_km"]


def segment_crosses_polygon(start, end, zone):
    reference_lat = (start["lat"] + end["lat"]) / 2

    a = project_point(start, reference_lat)
    b = project_point(end, reference_lat)

    polygon = [
        project_point(vertex, reference_lat)
        for vertex in zone["vertices"]
    ]

    if point_in_polygon(a, polygon) or point_in_polygon(b, polygon):
        return True

    for i in range(len(polygon)):
        c = polygon[i]
        d = polygon[(i + 1) % len(polygon)]

        if segments_intersect(a, b, c, d):
            return True

    return False


def check_route_airspace(route, zones):
    """
    Check every route segment against all restricted zones.

    Returns route safety status and detected intersections.
    """
    violations = []

    if len(route) < 2:
        return {
            "is_clear": True,
            "violations": [],
            "violation_count": 0,
        }

    for segment_index in range(len(route) - 1):
        start = route[segment_index]
        end = route[segment_index + 1]

        for zone in zones:
            zone_type = zone["type"]

            if zone_type == "circle":
                blocked = segment_crosses_circle(
                    start, end, zone
                )

            elif zone_type == "polygon":
                blocked = segment_crosses_polygon(
                    start, end, zone
                )

            else:
                blocked = False

            if blocked:
                violations.append({
                    "zone_name": zone["name"],
                    "zone_type": zone_type,
                    "from_waypoint": segment_index,
                    "to_waypoint": segment_index + 1,
                })

    return {
        "is_clear": len(violations) == 0,
        "violations": violations,
        "violation_count": len(violations),
    }
