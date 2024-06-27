import { Feature } from "models/features.js";
import { Repository } from "./repository.js";

export interface FeatureRepository extends Repository<Feature> {}
