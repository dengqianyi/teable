import { Injectable, Logger, Scope } from '@nestjs/common';
import { FieldKeyType } from '@teable-group/core';
import type { Almanac, Event, RuleResult } from 'json-rules-engine';
import { RecordOpenApiService } from '../../../../record/open-api/record-open-api.service';
import type { UpdateRecordRo } from '../../../../record/update-record.ro';
import type {
  IActionResponse,
  IConstSchema,
  IObjectSchema,
  ITemplateSchema,
} from '../../action-core';
import { actionConst, ActionCore, ActionResponseStatus } from '../../action-core';

export interface IUpdateRecordSchema extends Record<string, unknown> {
  tableId: IConstSchema;
  recordId: ITemplateSchema;
  fields: IObjectSchema;
}

export interface IUpdateRecordOptions {
  tableId: string;
  recordId: string;
  fields: { [fieldIdOrName: string]: unknown };
}

@Injectable({ scope: Scope.REQUEST })
export class UpdateRecord extends ActionCore {
  private logger = new Logger(UpdateRecord.name);

  constructor(private readonly recordOpenApiService: RecordOpenApiService) {
    super();
  }

  bindParams(id: string, params: IUpdateRecordSchema, priority?: number): this {
    return this.setName(id).setEvent({ type: id, params: params }).setPriority(priority);
  }

  onSuccess = async (event: Event, almanac: Almanac, _ruleResult: RuleResult): Promise<void> => {
    const { tableId, recordId, fields } = await this.parseInputSchema<IUpdateRecordOptions>(
      event.params as IUpdateRecordSchema,
      almanac
    );

    const updateData: UpdateRecordRo = {
      fieldKeyType: FieldKeyType.Id,
      record: { fields },
    };

    let outPut: IActionResponse<unknown>;

    await this.recordOpenApiService
      .updateRecordById(tableId, recordId, updateData)
      .then((recordVo) => {
        const { record } = recordVo;
        outPut = { data: record, status: ActionResponseStatus.OK };
      })
      .catch((error) => {
        this.logger.error(error.message, error?.stack);
        outPut = {
          error: error.message,
          data: undefined,
          status: ActionResponseStatus.InternalServerError,
        };
      })
      .finally(() => {
        almanac.addRuntimeFact(`${actionConst.OutPutFlag}${this.name}`, outPut);
      });
  };
}
