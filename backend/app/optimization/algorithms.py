
import math
import random
import heapq
from functools import lru_cache


EARTH_RADIUS_KM = 6371.0


def haversine(a, b):
    """Calculate geographical distance between two [lat, lon] points."""
    lat1, lon1 = map(math.radians, a)
    lat2, lon2 = map(math.radians, b)

    dlat = lat2 - lat1
    dlon = lon2 - lon1

    value = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2)
        * math.sin(dlon / 2) ** 2
    )

    value = max(0.0, min(1.0, value))

    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(value))


def route_distance(route, points):
    """Calculate total distance for a waypoint index sequence."""
    return sum(
        haversine(points[route[i]], points[route[i + 1]])
        for i in range(len(route) - 1)
    )


def genetic_algorithm(points, population_size=80, generations=250, seed=42):
    """
    Genetic Algorithm:
    - Starts at waypoint 0.
    - Visits every intermediate waypoint.
    - Finishes at the last waypoint.
    """
    n = len(points)

    if n < 2:
        raise ValueError("At least two waypoints are required.")

    if n == 2:
        return [0, 1], haversine(points[0], points[1])

    rng = random.Random(seed)
    middle = list(range(1, n - 1))

    def create_route():
        route = middle[:]
        rng.shuffle(route)
        return [0] + route + [n - 1]

    def crossover(parent1, parent2):
        size = len(parent1)

        if size <= 3:
            return parent1[:]

        left, right = sorted(
            rng.sample(range(1, size - 1), 2)
        )

        child = [None] * size
        child[0] = 0
        child[-1] = n - 1

        child[left:right + 1] = parent1[left:right + 1]

        remaining = [
            gene for gene in parent2[1:-1]
            if gene not in child
        ]

        cursor = 1

        for gene in remaining:
            while child[cursor] is not None:
                cursor += 1

            child[cursor] = gene

        return child

    def mutate(route, rate=0.15):
        route = route[:]

        # At least two intermediate points are needed for swapping.
        if len(route) > 3 and rng.random() < rate:
            i, j = rng.sample(
                range(1, len(route) - 1), 2
            )
            route[i], route[j] = route[j], route[i]

        return route

    population = [
        create_route()
        for _ in range(population_size)
    ]

    best_route = min(population, key=lambda r: route_distance(r, points))
    best_distance = route_distance(best_route, points)

    for _ in range(generations):
        population.sort(
            key=lambda r: route_distance(r, points)
        )

        current_best = population[0]
        current_distance = route_distance(current_best, points)

        if current_distance < best_distance:
            best_route = current_best[:]
            best_distance = current_distance

        # Elitism: preserve the best individuals.
        elite_count = max(2, population_size // 5)
        next_population = population[:elite_count]

        parent_pool = population[:max(2, population_size // 2)]

        while len(next_population) < population_size:
            parent1, parent2 = rng.sample(parent_pool, 2)

            child = crossover(parent1, parent2)
            child = mutate(child)

            next_population.append(child)

        population = next_population

    candidate = min(
        population,
        key=lambda r: route_distance(r, points)
    )

    candidate_distance = route_distance(candidate, points)

    if candidate_distance < best_distance:
        best_route = candidate[:]
        best_distance = candidate_distance

    return best_route, best_distance


def build_distance_matrix(points):
    """Build a symmetric geographical distance matrix."""
    n = len(points)

    matrix = [
        [0.0 for _ in range(n)]
        for _ in range(n)
    ]

    for i in range(n):
        for j in range(i + 1, n):
            distance = haversine(points[i], points[j])

            matrix[i][j] = distance
            matrix[j][i] = distance

    return matrix


def _shortest_waypoint_tour(points, start, goal, use_astar=False):
    """
    Exact waypoint-visiting route using Dijkstra or A*.

    The search state contains:
    - A bitmask of already visited intermediate waypoints.
    - The current waypoint.

    The goal can only be reached after all intermediate
    waypoints have been visited.
    """
    n = len(points)

    if n < 2:
        raise ValueError("At least two waypoints are required.")

    if not (0 <= start < n and 0 <= goal < n):
        raise ValueError("Invalid start or goal waypoint.")

    if start == goal:
        raise ValueError("Start and goal must be different.")

    distances_matrix = build_distance_matrix(points)

    middle = [
        i for i in range(n)
        if i != start and i != goal
    ]

    middle_count = len(middle)
    full_mask = (1 << middle_count) - 1

    # State: (visited_middle_mask, current_waypoint)
    initial_state = (0, start)

    distances = {initial_state: 0.0}
    previous = {}

    @lru_cache(maxsize=None)
    def mst_cost(nodes):
        """Calculate a minimum spanning tree lower bound."""
        if len(nodes) <= 1:
            return 0.0

        visited = {nodes[0]}
        remaining = set(nodes[1:])
        total = 0.0

        while remaining:
            best_distance = float("inf")
            best_node = None

            for current in visited:
                for candidate in remaining:
                    distance = distances_matrix[current][candidate]

                    if distance < best_distance:
                        best_distance = distance
                        best_node = candidate

            total += best_distance
            visited.add(best_node)
            remaining.remove(best_node)

        return total

    def heuristic(mask, current):
        """
        Admissible A* lower bound:
        minimum connection from current to remaining nodes
        plus the MST connecting all remaining nodes.
        """
        remaining = [
            middle[i]
            for i in range(middle_count)
            if not (mask & (1 << i))
        ]

        remaining.append(goal)

        connection = min(
            distances_matrix[current][node]
            for node in remaining
        )

        return connection + mst_cost(tuple(sorted(remaining)))

    initial_h = heuristic(0, start) if use_astar else 0.0

    # Heap entries: (priority, actual_cost, mask, current_waypoint)
    queue = [
        (initial_h, 0.0, 0, start)
    ]

    final_state = None

    while queue:
        _, current_distance, mask, current = heapq.heappop(queue)

        state = (mask, current)

        if current_distance > distances.get(state, float("inf")) + 1e-12:
            continue

        if mask == full_mask and current == goal:
            final_state = state
            break

        if mask == full_mask:
            neighbors = [(goal, mask)]
        else:
            neighbors = []

            for i, waypoint_index in enumerate(middle):
                bit = 1 << i

                if not (mask & bit):
                    neighbors.append(
                        (waypoint_index, mask | bit)
                    )

        for neighbor, new_mask in neighbors:
            new_distance = (
                current_distance
                + distances_matrix[current][neighbor]
            )

            next_state = (new_mask, neighbor)

            if new_distance + 1e-12 < distances.get(
                next_state, float("inf")
            ):
                distances[next_state] = new_distance
                previous[next_state] = state

                estimate = (
                    heuristic(new_mask, neighbor)
                    if use_astar else 0.0
                )

                priority = new_distance + estimate

                heapq.heappush(
                    queue,
                    (
                        priority,
                        new_distance,
                        new_mask,
                        neighbor
                    )
                )

    if final_state is None:
        return [], float("inf")

    # Reconstruct the complete waypoint sequence.
    route = []
    current_state = final_state

    while current_state != initial_state:
        route.append(current_state[1])
        current_state = previous[current_state]

    route.append(start)
    route.reverse()

    return route, distances[final_state]


def dijkstra(points, start=0, goal=None):
    """Exact shortest route visiting every required waypoint."""
    if goal is None:
        goal = len(points) - 1

    return _shortest_waypoint_tour(
        points,
        start,
        goal,
        use_astar=False
    )


def a_star(points, start=0, goal=None):
    """A* route visiting every required waypoint using an MST heuristic."""
    if goal is None:
        goal = len(points) - 1

    return _shortest_waypoint_tour(
        points,
        start,
        goal,
        use_astar=True
    )
