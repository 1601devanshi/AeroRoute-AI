
import heapq
import math
from typing import Any


EARTH_RADIUS_KM = 6371.0088
BOUNDARY_EPSILON_KM = 0.15


def _to_xy(point: dict, reference_lat: float) -> tuple[float, float]:
    """Convert latitude/longitude to a local kilometre coordinate system."""
    lat = math.radians(float(point["lat"]))
    lon = math.radians(float(point["lon"]))
    ref = math.radians(reference_lat)

    x = EARTH_RADIUS_KM * lon * math.cos(ref)
    y = EARTH_RADIUS_KM * lat

    return x, y


def _to_latlon(point: tuple[float, float], reference_lat: float) -> dict:
    """Convert local kilometre coordinates back to latitude/longitude."""
    x, y = point
    ref = math.radians(reference_lat)

    lat = math.degrees(y / EARTH_RADIUS_KM)
    lon = math.degrees(x / (EARTH_RADIUS_KM * math.cos(ref)))

    return {"lat": lat, "lon": lon}


def _distance(a: tuple[float, float], b: tuple[float, float]) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def _point_segment_distance(
    point: tuple[float, float],
    start: tuple[float, float],
    end: tuple[float, float],
) -> float:
    dx = end[0] - start[0]
    dy = end[1] - start[1]

    if dx == 0 and dy == 0:
        return _distance(point, start)

    t = (
        (point[0] - start[0]) * dx
        + (point[1] - start[1]) * dy
    ) / (dx * dx + dy * dy)

    t = max(0.0, min(1.0, t))

    closest = (
        start[0] + t * dx,
        start[1] + t * dy,
    )

    return _distance(point, closest)


def _point_in_polygon(
    point: tuple[float, float],
    polygon: list[tuple[float, float]],
) -> bool:
    x, y = point
    inside = False

    j = len(polygon) - 1

    for i in range(len(polygon)):
        xi, yi = polygon[i]
        xj, yj = polygon[j]

        intersects = (
            (yi > y) != (yj > y)
            and x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-12) + xi
        )

        if intersects:
            inside = not inside

        j = i

    return inside


def _orientation(a, b, c) -> float:
    return (
        (b[0] - a[0]) * (c[1] - a[1])
        - (b[1] - a[1]) * (c[0] - a[0])
    )


def _proper_segments_intersect(a, b, c, d) -> bool:
    """Detect a proper crossing, excluding shared boundary endpoints."""
    o1 = _orientation(a, b, c)
    o2 = _orientation(a, b, d)
    o3 = _orientation(c, d, a)
    o4 = _orientation(c, d, b)

    return (
        ((o1 > 1e-9 and o2 < -1e-9) or
         (o1 < -1e-9 and o2 > 1e-9))
        and
        ((o3 > 1e-9 and o4 < -1e-9) or
         (o3 < -1e-9 and o4 > 1e-9))
    )


def _segment_hits_polygon(start, end, polygon) -> bool:
    if _point_in_polygon(start, polygon):
        return True

    if _point_in_polygon(end, polygon):
        return True

    midpoint = (
        (start[0] + end[0]) / 2,
        (start[1] + end[1]) / 2,
    )

    if _point_in_polygon(midpoint, polygon):
        return True

    for i in range(len(polygon)):
        a = polygon[i]
        b = polygon[(i + 1) % len(polygon)]

        if _proper_segments_intersect(start, end, a, b):
            return True

    return False


def _normalize_zones(
    zones: list[dict[str, Any]],
    reference_lat: float,
    safety_margin_km: float,
) -> list[dict[str, Any]]:
    normalized = []

    for zone in zones:
        zone_type = zone.get("type")

        if zone_type == "circle":
            center = _to_xy(zone["center"], reference_lat)

            radius = (
                float(zone["radius_km"])
                + safety_margin_km
            )

            normalized.append({
                "type": "circle",
                "name": zone.get("name", "Circular restricted zone"),
                "center": center,
                "radius": radius,
            })

        elif zone_type == "polygon":
            vertices = [
                _to_xy(vertex, reference_lat)
                for vertex in zone["vertices"]
            ]

            center = (
                sum(p[0] for p in vertices) / len(vertices),
                sum(p[1] for p in vertices) / len(vertices),
            )

            # Radially expand vertices to create a conservative
            # candidate boundary for the detour calculation.
            expanded = []

            for vertex in vertices:
                dx = vertex[0] - center[0]
                dy = vertex[1] - center[1]
                length = math.hypot(dx, dy)

                if length == 0:
                    expanded.append(vertex)
                    continue

                expansion = safety_margin_km + BOUNDARY_EPSILON_KM

                expanded.append((
                    vertex[0] + dx / length * expansion,
                    vertex[1] + dy / length * expansion,
                ))

            normalized.append({
                "type": "polygon",
                "name": zone.get("name", "Polygon restricted zone"),
                "vertices": expanded,
            })

    return normalized


def _segment_is_clear(start, end, zones) -> bool:
    for zone in zones:
        if zone["type"] == "circle":
            center = zone["center"]
            radius = zone["radius"]

            if _point_segment_distance(center, start, end) <= radius:
                return False

        elif zone["type"] == "polygon":
            if _segment_hits_polygon(
                start,
                end,
                zone["vertices"],
            ):
                return False

    return True


def _generate_candidate_points(zones) -> list[tuple[float, float]]:
    candidates = []

    for zone in zones:
        if zone["type"] == "circle":
            center = zone["center"]
            radius = zone["radius"] + BOUNDARY_EPSILON_KM

            # 32 points around the expanded circular boundary.
            for i in range(32):
                angle = 2 * math.pi * i / 32

                candidates.append((
                    center[0] + radius * math.cos(angle),
                    center[1] + radius * math.sin(angle),
                ))

        elif zone["type"] == "polygon":
            candidates.extend(zone["vertices"])

    return candidates


def _shortest_clear_path(
    start: tuple[float, float],
    end: tuple[float, float],
    zones: list[dict],
) -> list[tuple[float, float]] | None:
    """Find a shortest collision-free path through a visibility graph."""
    if not _segment_is_clear(start, end, zones):
        pass
    else:
        return [start, end]

    candidates = _generate_candidate_points(zones)

    # Remove points that are inside any restricted zone.
    nodes = [start, end]

    for candidate in candidates:
        if _segment_is_clear(candidate, candidate, zones):
            if all(_distance(candidate, existing) > 0.01 for existing in nodes):
                nodes.append(candidate)

    start_index = 0
    end_index = 1

    distances = [float("inf")] * len(nodes)
    previous = [None] * len(nodes)
    distances[start_index] = 0.0

    queue = [(0.0, start_index)]

    while queue:
        current_distance, current = heapq.heappop(queue)

        if current_distance > distances[current]:
            continue

        if current == end_index:
            break

        for neighbor in range(len(nodes)):
            if neighbor == current:
                continue

            if not _segment_is_clear(
                nodes[current],
                nodes[neighbor],
                zones,
            ):
                continue

            edge_distance = _distance(
                nodes[current],
                nodes[neighbor],
            )

            new_distance = current_distance + edge_distance

            if new_distance < distances[neighbor]:
                distances[neighbor] = new_distance
                previous[neighbor] = current

                heapq.heappush(
                    queue,
                    (new_distance, neighbor),
                )

    if distances[end_index] == float("inf"):
        return None

    path_indices = []
    current = end_index

    while current is not None:
        path_indices.append(current)
        current = previous[current]

    path_indices.reverse()

    return [nodes[index] for index in path_indices]


def generate_detour_route(
    route: list[dict],
    zones: list[dict],
    safety_margin_km: float = 1.0,
) -> dict:
    """
    Generate a detour route while preserving the order of mission waypoints.

    Returns the route, distance, detour count and feasibility status.
    """
    if len(route) < 2:
        return {
            "status": "no_feasible_route",
            "route": [],
            "distance_km": 0.0,
            "detour_waypoint_count": 0,
            "message": "At least two mission waypoints are required.",
        }

    if not zones:
        return {
            "status": "clear",
            "route": route,
            "distance_km": sum(
                _distance(
                    _to_xy(route[i], sum(p["lat"] for p in route) / len(route)),
                    _to_xy(route[i + 1], sum(p["lat"] for p in route) / len(route)),
                )
                for i in range(len(route) - 1)
            ),
            "detour_waypoint_count": 0,
            "message": "No restricted zones were supplied.",
        }

    reference_lat = sum(
        float(point["lat"]) for point in route
    ) / len(route)

    normalized_zones = _normalize_zones(
        zones,
        reference_lat,
        safety_margin_km,
    )

    mission_xy = [
        _to_xy(point, reference_lat)
        for point in route
    ]

    # A mission waypoint inside a restricted zone cannot be avoided
    # without changing the requested mission.
    for index, point in enumerate(mission_xy):
        if not _segment_is_clear(point, point, normalized_zones):
            return {
                "status": "no_feasible_route",
                "route": [],
                "distance_km": None,
                "detour_waypoint_count": 0,
                "message": (
                    f"Mission waypoint {index} is inside or too close "
                    "to a restricted zone."
                ),
            }

    complete_path = [mission_xy[0]]

    for index in range(len(mission_xy) - 1):
        leg_path = _shortest_clear_path(
            mission_xy[index],
            mission_xy[index + 1],
            normalized_zones,
        )

        if leg_path is None:
            return {
                "status": "no_feasible_route",
                "route": [],
                "distance_km": None,
                "detour_waypoint_count": 0,
                "message": (
                    f"No safe detour could be generated for mission "
                    f"leg {index} to {index + 1}."
                ),
            }

        # Avoid duplicating the previous leg's final waypoint.
        complete_path.extend(leg_path[1:])

    # Validate every final segment again.
    for index in range(len(complete_path) - 1):
        if not _segment_is_clear(
            complete_path[index],
            complete_path[index + 1],
            normalized_zones,
        ):
            return {
                "status": "no_feasible_route",
                "route": [],
                "distance_km": None,
                "detour_waypoint_count": 0,
                "message": "Final route validation failed.",
            }

    distance_km = sum(
        _distance(complete_path[i], complete_path[i + 1])
        for i in range(len(complete_path) - 1)
    )

    output_route = [
        _to_latlon(point, reference_lat)
        for point in complete_path
    ]

    return {
        "status": "clear",
        "route": output_route,
        "distance_km": round(distance_km, 3),
        "detour_waypoint_count": max(0, len(output_route) - len(route)),
        "message": "A detour route was generated and passed geometric validation.",
    }
