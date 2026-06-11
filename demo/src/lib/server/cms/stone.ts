import { db } from '$lib/server/db';
export { createStone, type CollectionName, type Post } from './stone-factory';
import { createStone } from './stone-factory';

export const stone = createStone(db);
