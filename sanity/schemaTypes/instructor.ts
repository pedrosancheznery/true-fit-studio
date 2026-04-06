import { defineField, defineType } from 'sanity'

export const instructor = defineType({
  name: 'instructor',
  title: 'Instructor',
  type: 'document',
  fields: [
    { name: 'name', type: 'string' },
    { name: 'bio', type: 'text' },
    { name: 'image', type: 'image' },
  ]
})

