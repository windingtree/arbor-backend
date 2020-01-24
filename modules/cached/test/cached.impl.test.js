const _ = require('lodash');
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const { ne } = Op;

const impl = require('../lib/impl');

const upsertMock = (userData) => ({
    get: () => userData,
    ...userData
});

describe('upsertOrgid - create or insert org id', () => {
    let upsertOrgid;
    beforeEach(async () => {
        ({ upsertOrgid } = await impl(
            ()=> (
                    { app: { secret: 'secret' }}
            ),
            { orgid: { upsert: upsertMock } }
        ));
    });
    it('should create valid organization', async () => {
        await upsertOrgid({
            orgid: '0x0'
        })
    });

    it('should create and after update valid organization', async () => {
        const orgidPayload = {
            orgid: '0x0'
        };
        await upsertOrgid(orgidPayload);
        await upsertOrgid(orgidPayload);
    });

    it('should fail if input didn`t have required params' , async () => {
        await upsertOrgid({})
    });
});
