export const TRANSFORMATION_STATUS = ['PROCESSING', 'COMPLETED', 'FAILED'] as const;
export type TransformationStatus = typeof TRANSFORMATION_STATUS[number];