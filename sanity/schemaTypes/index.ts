import { type SchemaTypeDefinition } from 'sanity'
import { workoutClass } from './workoutClass'
import { instructor } from './instructor'

// Exporting just the array, not an object
export const schemaTypes: SchemaTypeDefinition[] = [workoutClass, instructor]
