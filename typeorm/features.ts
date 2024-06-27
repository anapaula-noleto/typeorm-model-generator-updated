import { In, Repository } from "typeorm";
import { TypeORMRepository } from "./typeORMRepository.js";
import { FeatureRepository } from "models/.js";

export class TypeORMFeatureRepository
  extends TypeORMRepository<Feature>
  implements FeatureRepository
{
  constructor(repository: Repository<Feature>) {
    super(repository);
  }
}
