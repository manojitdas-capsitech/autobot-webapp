import dotenv from 'dotenv';
import path from 'path';

const root = process.cwd();

// .env wins when both files define the same key. .env.docker fills anything still unset.
dotenv.config({ path: path.join(root, '.env') });
dotenv.config({ path: path.join(root, '.env.docker') });
