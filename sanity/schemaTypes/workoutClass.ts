import { defineField, defineType } from 'sanity'

export const workoutClass = defineType({
  name: 'workoutClass',
  title: 'Workout Class',
  type: 'document',
  fields: [
    defineField({ name: 'title', type: 'string', title: 'Title' }),
    defineField({ name: 'description', type: 'text', title: 'Description' }),
    defineField({
      name: 'instructor',
      title: 'Instructor',
      type: 'reference',
      to: [{ type: 'instructor' }], // Points to your new instructor schema
    }),
    defineField({ name: 'duration', type: 'number', title: 'Duration (mins)' }),
    defineField({ name: 'capacity', type: 'number', title: 'Capacity' }),
    defineField({ name: 'stripePriceId', type: 'string', title: 'Stripe Price ID' }),
    defineField({
      name: 'dayOfWeek',
      title: 'Day of the Week',
      type: 'string',
      options: {
        list: [
          { title: 'Saturday', value: '0' },
          { title: 'Sunday', value: '1' },
          { title: 'Monday', value: '2' },
          { title: 'Tuesday', value: '3' },
          { title: 'Wednesday', value: '4' },
          { title: 'Thursday', value: '5' },
          { title: 'Friday', value: '6' },
        ],
      },
    }),
    defineField({
      name: 'startTime',
      title: 'Start Time (e.g., 18:30)',
      type: 'string', // Store as "HH:mm"
    }),
  ],
})
