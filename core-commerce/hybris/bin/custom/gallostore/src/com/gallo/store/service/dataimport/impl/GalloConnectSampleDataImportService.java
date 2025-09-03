package com.gallo.store.service.dataimport.impl;

import de.hybris.platform.commerceservices.dataimport.impl.SampleDataImportService;
import de.hybris.platform.core.initialization.SystemSetupContext;

public class GalloConnectSampleDataImportService extends SampleDataImportService {
    /**
     * Imports the data related to Commerce Org.
     *
     * @param context
     *           the context used.
     */
    public void importCommerceOrgData(final SystemSetupContext context)
    {
        final String extensionName = context.getExtensionName();

        getSetupImpexService().importImpexFile(String.format("/%s/import/sampledata/commerceorg/user-groups.impex", extensionName),
                false);
        getSetupImpexService().importImpexFile(String.format("/%s/import/sampledata/backoffice/registration/users.impex", extensionName),
                false);
        getSetupImpexService().importImpexFile(String.format("/%s/import/sampledata/accountsummary/documents.impex", extensionName),
                false);
    }
}
