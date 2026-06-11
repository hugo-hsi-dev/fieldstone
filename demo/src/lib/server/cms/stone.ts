import { db } from '$lib/server/db';
export {
	createStone,
	type CollectionName,
	type Document,
	type DocumentData
} from './stone-factory';
import { createStone } from './stone-factory';

export const stone = createStone(db);
