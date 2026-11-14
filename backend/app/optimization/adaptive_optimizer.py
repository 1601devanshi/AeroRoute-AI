
"""Adaptive Genetic Algorithm controller for AeroRoute AI."""

from app.optimization.algorithms import genetic_algorithm


def calculate_adaptive_parameters(
    population_size: int = 80,
    generations: int = 250,
    stagnation_count: int = 0,
    diversity: float = 0.5
) -> dict:
    """Adjust GA parameters according to search progress."""

    if population_size < 10 or generations < 10:
        raise ValueError("Population and generations must be at least 10.")

    if stagnation_count < 0:
        raise ValueError("Stagnation count cannot be negative.")

    if not 0 <= diversity <= 1:
        raise ValueError("Diversity must be between 0 and 1.")

    adaptive_population = population_size
    adaptive_generations = generations
    mutation_rate = 0.10

    if stagnation_count >= 10:
        adaptive_population = int(population_size * 1.5)
        adaptive_generations = int(generations * 1.2)
        mutation_rate = 0.25

    elif stagnation_count >= 5:
        adaptive_population = int(population_size * 1.25)
        mutation_rate = 0.18

    if diversity < 0.2:
        mutation_rate = max(mutation_rate, 0.30)

    return {
        "population_size": min(adaptive_population, 500),
        "generations": min(adaptive_generations, 2000),
        "mutation_rate": mutation_rate,
        "diversity": diversity,
        "stagnation_count": stagnation_count
    }


def run_adaptive_genetic_algorithm(
    points: list,
    population_size: int = 80,
    generations: int = 250,
    stagnation_count: int = 0,
    diversity: float = 0.5,
    seed: int = 42
) -> dict:
    """
    Run the existing GA with adaptively selected search settings.

    Note: The existing genetic_algorithm implementation controls
    its own mutation operation. The mutation_rate here is returned
    as a diagnostic recommendation, not injected into that function.
    """

    if len(points) < 2:
        raise ValueError("At least two points are required.")

    parameters = calculate_adaptive_parameters(
        population_size=population_size,
        generations=generations,
        stagnation_count=stagnation_count,
        diversity=diversity
    )

    result = genetic_algorithm(
        points,
        population_size=parameters["population_size"],
        generations=parameters["generations"],
        seed=seed
    )

    return {
        "algorithm": "Adaptive Genetic Algorithm",
        "parameters": parameters,
        "result": result,
        "adaptive_search_enabled": True,
        "note": (
            "Population and generation settings are adapted. "
            "Mutation rate is currently a recommended diagnostic "
            "value; the existing GA mutation implementation is unchanged."
        )
    }
