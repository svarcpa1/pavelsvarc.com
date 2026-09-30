<?php

// Shared personal-record definition (include-only, produces no output).
//
// A logged exercise is a record when its weight is strictly higher than every
// earlier weight for the same exercise + machine (case-insensitive, any gym).
// "Earlier" = earlier workout, or earlier entry within the same workout.
// The first-ever entry has nothing to beat, so it is never a record.
//
// Use as a CTE: "WITH " . LL_RECORDS_CTE . " SELECT ... JOIN ll_records r ON r.id = e.id"
const LL_RECORDS_CTE = "
    ll_records AS (
        SELECT sub.id,
               sub.previous_best,
               COALESCE(sub.max_weight > sub.previous_best, false) AS is_record
        FROM (
            SELECT e.id,
                   e.max_weight,
                   MAX(e.max_weight) OVER (
                       PARTITION BY LOWER(e.name), LOWER(COALESCE(e.machine, ''))
                       ORDER BY w.started_at, e.id
                       ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
                   ) AS previous_best
            FROM ll_exercises e
            JOIN ll_workouts w ON w.id = e.workout_id
        ) sub
    )";

// Record info for one exercise row: ['previous_best' => ?string, 'is_record' => bool]
function getRecordInfo(PDO $db, int $exerciseId): array {
    $stmt = $db->prepare('WITH ' . LL_RECORDS_CTE . ' SELECT previous_best, is_record FROM ll_records WHERE id = :id');
    $stmt->execute(['id' => $exerciseId]);
    $row = $stmt->fetch();
    return [
        'previous_best' => $row['previous_best'] ?? null,
        'is_record'     => (bool)($row['is_record'] ?? false),
    ];
}
