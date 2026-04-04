import { defineField, defineType } from 'sanity'

export const workoutClass = defineType({
  name: 'workoutClass',
  title: 'Workout Class',
  type: 'document',
  fields: [
    defineField({ name: 'title', type: 'string', title: 'Title' }),
    defineField({ name: 'description', type: 'text', title: 'Description' }),
    defineField({ name: 'instructor', type: 'string', title: 'Instructor' }),
    defineField({ name: 'startTime', type: 'datetime', title: 'Start Time' }),
    defineField({ name: 'duration', type: 'number', title: 'Duration (mins)' }),
    defineField({ name: 'capacity', type: 'number', title: 'Capacity' }),
    defineField({ name: 'stripePriceId', type: 'string', title: 'Stripe Price ID' }),
  ],
})
