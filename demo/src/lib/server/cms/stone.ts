import { getFieldstone, type DocumentData } from '@fieldstone/client';
import config from '$fieldstone-config';

export const stone = await getFieldstone({ config });
export type CollectionName = keyof typeof config.collections & string;
export type { DocumentData };
