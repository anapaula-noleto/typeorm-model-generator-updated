import { Repository } from "../ports/repository.js";
import {
  FindConditions,
  OrderDirection,
  Page,
  PaginatedFindConditions,
  FilterOrganizationOptions,
} from "../dtos/generic.js";
import { Repository as BaseRepository } from "typeorm";
import { FindOptionsWhere } from "typeorm/find-options/FindOptionsWhere.js";

export abstract class TypeORMRepository<T> implements Repository<T> {
  constructor(
    protected repository: BaseRepository<T>,
    protected readonly relationsIdsLoadedInFindPaginatedBy: string[] = []
  ) {}

  public async delete(entity: T): Promise<void> {
    await this.repository.remove(entity);
  }

  public async deleteMany(entities: T[]): Promise<void> {
    await this.repository.remove(entities);
  }

  protected getFindOptionsWhere(
    conditions: FindConditions<T>
  ): FindOptionsWhere<T> {
    const where: FindOptionsWhere<T> = {};
    for (const [key, value] of Object.entries(conditions)) {
      if (value !== undefined) {
        where[key] = value;
      }
    }

    return where;
  }

  public async findBy(conditions: FindConditions<T>): Promise<T[]> {
    const where = this.getFindOptionsWhere(conditions);
    return await this.repository.findBy(where);
  }

  public async findOneBy(conditions: FindConditions<T>): Promise<T | null> {
    const where = this.getFindOptionsWhere(conditions);
    return await this.repository.findOneBy(where);
  }

  public async insert(entity: T): Promise<T> {
    return await this.repository.save(entity);
  }

  public async insertMany(entities: T[]): Promise<T[]> {
    return await this.repository.save(entities);
  }

  public async paginatedFindBy(
    conditions: PaginatedFindConditions<T>,
    filterOrganizationOptions?: FilterOrganizationOptions
  ): Promise<Page<T>> {
    const query = this.repository.createQueryBuilder();

    const page = conditions.page || 1;
    const itemsPerPage = conditions.itemsPerPage || 50;
    const take = itemsPerPage;
    const skip = itemsPerPage * (page - 1);

    query.skip(skip).take(take);

    if (conditions.conditions) {
      const where = this.getFindOptionsWhere(conditions.conditions);
      query.where(where);
    }

    if (conditions.orderBy && typeof conditions.orderBy === "string") {
      const orderDirection = conditions.orderDirection || OrderDirection.ASC;

      if (conditions.orderBy === "organizationId") {
        conditions.orderBy = "organization_id" as keyof T & string;
      }
      query.addOrderBy(conditions.orderBy, orderDirection);
    }

    if (filterOrganizationOptions) {
      const { featuresIds, desiredFeature, currentUserOrganizationId } =
        filterOrganizationOptions;
      const userHasDesiredFeature = featuresIds?.includes(desiredFeature);
      if (currentUserOrganizationId && !userHasDesiredFeature) {
        query.andWhere("organization_id = :organizationId", {
          organizationId: currentUserOrganizationId,
        });
      }
    }

    query.loadAllRelationIds({
      disableMixedMap: true,
      relations: this.relationsIdsLoadedInFindPaginatedBy,
    });

    const [rows, totalRows] = await query.getManyAndCount();
    return {
      rows,
      page,
      totalRows,
    };
  }

  public async update(entity: T): Promise<T> {
    return await this.repository.save(entity);
  }

  public async updateMany(entities: T[]): Promise<T[]> {
    return await this.repository.save(entities);
  }
}
