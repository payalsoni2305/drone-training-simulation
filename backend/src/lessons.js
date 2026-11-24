/**
 * Lesson catalog served to the frontend.
 *
 * The backend owns the metadata (ids, titles, pass marks, ordering).
 * The frontend owns how each lesson is flown/checked (objectives, scenery).
 * Keep the ids in sync with `frontend/src/sim/lessons.ts`.
 */
export const LESSONS = [
  {
    id: 'first-flight',
    order: 1,
    track: 'pilot',
    title: 'First Flight',
    summary: 'Arm the drone, take off, hold a steady hover and land softly on the pad.',
    difficulty: 'beginner',
    parSeconds: 90,
    passScore: 60,
  },
  {
    id: 'move-and-navigate',
    order: 2,
    track: 'pilot',
    title: 'Move & Navigate',
    summary: 'Fly through a course of waypoint rings and return to land on the pad.',
    difficulty: 'beginner',
    parSeconds: 150,
    passScore: 60,
  },
  {
    id: 'camera-basics',
    order: 3,
    track: 'camera',
    title: 'Camera Basics: Photos',
    summary: 'Use the gimbal and zoom to frame subjects and capture clean aerial photos.',
    difficulty: 'intermediate',
    parSeconds: 180,
    passScore: 60,
  },
  {
    id: 'record-video',
    order: 4,
    track: 'camera',
    title: 'Record a Video Clip',
    summary: 'Record a smooth video clip of a landmark while keeping it in frame, then land.',
    difficulty: 'intermediate',
    parSeconds: 180,
    passScore: 60,
  },
  {
    id: 'aerial-survey',
    order: 5,
    track: 'camera',
    title: 'Aerial Survey Mission',
    summary: 'Photograph three landmarks, then return home with battery to spare.',
    difficulty: 'advanced',
    parSeconds: 240,
    passScore: 65,
  },
]

export const LESSON_IDS = new Set(LESSONS.map((l) => l.id))

export function getLesson(id) {
  return LESSONS.find((l) => l.id === id) ?? null
}
