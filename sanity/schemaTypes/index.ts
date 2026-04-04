import { type SchemaTypeDefinition } from 'sanity'
import { workoutClass } from './workoutClass'

// Exporting just the array, not an object
export const schemaTypes: SchemaTypeDefinition[] = [workoutClass]
