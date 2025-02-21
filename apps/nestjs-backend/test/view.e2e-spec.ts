/* eslint-disable sonarjs/no-duplicate-string */
import type { INestApplication } from '@nestjs/common';
import type { IColumn, IFieldRo, IFieldVo, IViewRo } from '@teable/core';
import { FieldType, Relationship, ViewType } from '@teable/core';
import type { ICreateTableRo, ITableFullVo, ITableVo } from '@teable/openapi';
import {
  updateViewDescription,
  updateViewName,
  getViewFilterLinkRecords,
  getTableById,
} from '@teable/openapi';
import {
  createField,
  getFields,
  initApp,
  createView,
  deleteTable,
  createTable,
  getViews,
  getView,
} from './utils/init-app';

const defaultViews = [
  {
    name: 'Grid view',
    type: ViewType.Grid,
  },
];

describe('OpenAPI ViewController (e2e)', () => {
  let app: INestApplication;
  let table: ITableFullVo;
  const baseId = globalThis.testConfig.baseId;

  beforeAll(async () => {
    const appCtx = await initApp();
    app = appCtx.app;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    table = await createTable(baseId, { name: 'table1' });
  });

  afterEach(async () => {
    const result = await deleteTable(baseId, table.id);
    console.log('clear table: ', result);
  });

  it('/api/table/{tableId}/view (GET)', async () => {
    const viewsResult = await getViews(table.id);
    expect(viewsResult).toMatchObject(defaultViews);
  });

  it('/api/table/{tableId}/view (POST)', async () => {
    const viewRo: IViewRo = {
      name: 'New view',
      description: 'the new view',
      type: ViewType.Grid,
    };

    await createView(table.id, viewRo);

    const result = await getViews(table.id);
    expect(result).toMatchObject([
      ...defaultViews,
      {
        name: 'New view',
        description: 'the new view',
        type: ViewType.Grid,
      },
    ]);
  });

  it('should update view simple properties', async () => {
    const viewRo: IViewRo = {
      name: 'New view',
      description: 'the new view',
      type: ViewType.Grid,
    };

    const view = await createView(table.id, viewRo);

    await updateViewName(table.id, view.id, { name: 'New view 2' });
    await updateViewDescription(table.id, view.id, { description: 'description2' });
    const viewNew = await getView(table.id, view.id);

    expect(viewNew.name).toEqual('New view 2');
    expect(viewNew.description).toEqual('description2');
  });

  it('should create view with field order', async () => {
    // get fields
    const fields = await getFields(table.id);
    const testFieldId = fields?.[0].id;
    const assertOrder = 10;
    const columnMeta = fields.reduce<Record<string, IColumn>>(
      (pre, cur, index) => {
        pre[cur.id] = {} as IColumn;
        pre[cur.id].order = index === 0 ? assertOrder : index;
        return pre;
      },
      {} as Record<string, IColumn>
    );

    const viewResponse = await createView(table.id, {
      name: 'view',
      columnMeta,
      type: ViewType.Grid,
    });

    const { columnMeta: columnMetaResponse } = viewResponse;
    const order = columnMetaResponse?.[testFieldId]?.order;
    expect(order).toEqual(assertOrder);
    expect(fields.length).toEqual(Object.keys(columnMetaResponse).length);
  });

  it('fields in new view should sort by created time and primary field is always first', async () => {
    const viewRo: IViewRo = {
      name: 'New view',
      description: 'the new view',
      type: ViewType.Grid,
    };

    const oldFields: IFieldVo[] = [];
    oldFields.push(await createField(table.id, { type: FieldType.SingleLineText }));
    oldFields.push(await createField(table.id, { type: FieldType.SingleLineText }));
    oldFields.push(await createField(table.id, { type: FieldType.SingleLineText }));

    const newView = await createView(table.id, viewRo);
    const newFields = await getFields(table.id, newView.id);

    expect(newFields.slice(3)).toMatchObject(oldFields);
  });

  describe('/api/table/{tableId}/view/:viewId/filter-link-records (GET)', () => {
    let table: ITableVo;
    let linkTable1: ITableFullVo;
    let linkTable2: ITableFullVo;

    const linkTable1FieldRo: IFieldRo[] = [
      {
        name: 'single_line_text_field',
        type: FieldType.SingleLineText,
      },
    ];

    const linkTable2FieldRo: IFieldRo[] = [
      {
        name: 'single_line_text_field',
        type: FieldType.SingleLineText,
      },
    ];

    const linkTable1RecordRo: ICreateTableRo['records'] = [
      {
        fields: {
          single_line_text_field: 'link_table1_record1',
        },
      },
      {
        fields: {
          single_line_text_field: 'link_table1_record2',
        },
      },
      {
        fields: {
          single_line_text_field: 'link_table1_record3',
        },
      },
    ];
    const linkTable2RecordRo: ICreateTableRo['records'] = [
      {
        fields: {
          single_line_text_field: 'link_table2_record1',
        },
      },
      {
        fields: {
          single_line_text_field: 'link_table2_record2',
        },
      },
      {
        fields: {
          single_line_text_field: 'link_table2_record3',
        },
      },
    ];

    beforeAll(async () => {
      const fullTable = await createTable(baseId, {
        name: 'filter_link_records',
        fields: [
          {
            name: 'link_field1',
            type: FieldType.SingleLineText,
          },
        ],
        records: [],
      });

      linkTable1 = await createTable(baseId, {
        name: 'link_table1',
        fields: [
          ...linkTable1FieldRo,
          {
            type: FieldType.Link,
            options: {
              foreignTableId: fullTable.id,
              relationship: Relationship.OneMany,
            },
          },
        ],
        records: linkTable1RecordRo,
      });

      linkTable2 = await createTable(baseId, {
        name: 'link_table2',
        fields: [
          ...linkTable2FieldRo,
          {
            type: FieldType.Link,
            options: {
              foreignTableId: fullTable.id,
              relationship: Relationship.OneMany,
            },
          },
        ],
        records: linkTable2RecordRo,
      });

      const tableData = await getTableById(baseId, fullTable.id, { includeContent: true });
      table = tableData.data;
    });

    afterAll(async () => {
      await deleteTable(baseId, table.id);
      await deleteTable(baseId, linkTable1.id);
      await deleteTable(baseId, linkTable2.id);
    });

    it('should return filter link records', async () => {
      const viewRo: IViewRo = {
        name: 'New view',
        description: 'the new view',
        type: ViewType.Grid,
        filter: {
          filterSet: [
            {
              fieldId: table.fields![1].id,
              value: linkTable1.records[0].id,
              operator: 'is',
            },
            {
              filterSet: [
                {
                  fieldId: table.fields![1].id,
                  value: [linkTable1.records[1].id, linkTable1.records[2].id],
                  operator: 'isAnyOf',
                },
              ],
              conjunction: 'and',
            },
            {
              fieldId: table.fields![2].id,
              value: linkTable2.records[0].id,
              operator: 'is',
            },
            {
              filterSet: [
                {
                  fieldId: table.fields![2].id,
                  value: [linkTable2.records[2].id],
                  operator: 'isAnyOf',
                },
              ],
              conjunction: 'and',
            },
          ],
          conjunction: 'and',
        },
      };

      const view = await createView(table.id, viewRo);

      const { data: records } = await getViewFilterLinkRecords(table.id, view.id);

      expect(records).toMatchObject([
        {
          tableId: linkTable1.id,
          records: linkTable1.records.map(({ id, name }) => ({ id, title: name })),
        },
        {
          tableId: linkTable2.id,
          records: [
            { id: linkTable2.records[0].id, title: linkTable2.records[0].name },
            {
              id: linkTable2.records[2].id,
              title: linkTable2.records[2].name,
            },
          ],
        },
      ]);
    });
  });
});
