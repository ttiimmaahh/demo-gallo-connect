/*
 * Copyright (c) 2021 SAP SE or an SAP affiliate company. All rights reserved.
 */
package com.gallo.store.setup;

import static com.gallo.store.constants.GallostoreConstants.PLATFORM_LOGO_CODE;

import com.gallo.store.service.dataimport.impl.GalloConnectSampleDataImportService;
import de.hybris.platform.commerceservices.dataimport.impl.CoreDataImportService;
import de.hybris.platform.commerceservices.setup.AbstractSystemSetup;
import de.hybris.platform.commerceservices.setup.data.ImportData;
import de.hybris.platform.commerceservices.setup.events.CoreDataImportedEvent;
import de.hybris.platform.commerceservices.setup.events.SampleDataImportedEvent;
import de.hybris.platform.core.initialization.SystemSetup;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import com.gallo.store.constants.GallostoreConstants;
import com.gallo.store.service.GallostoreService;
import de.hybris.platform.core.initialization.SystemSetupContext;
import de.hybris.platform.core.initialization.SystemSetupParameter;
import de.hybris.platform.core.initialization.SystemSetupParameterMethod;


@SystemSetup(extension = GallostoreConstants.EXTENSIONNAME)
public class GallostoreSystemSetup extends AbstractSystemSetup {
    public static final String GALLOCONNECT = "galloConnect";
    public static final String GALLOCONNECT_STANDALONE = "galloConnect-standalone";

    private static final String IMPORT_CORE_DATA = "importCoreData";
    private static final String IMPORT_SAMPLE_DATA = "importSampleData";
    private static final String ACTIVATE_SOLR_CRON_JOBS = "activateSolrCronJobs";

    private CoreDataImportService coreDataImportService;
    private GalloConnectSampleDataImportService galloConnectSampleDataImportService;

    @SystemSetupParameterMethod
    @Override
    public List<SystemSetupParameter> getInitializationOptions() {
        final List<SystemSetupParameter> params = new ArrayList<SystemSetupParameter>();

        params.add(createBooleanSystemSetupParameter(IMPORT_CORE_DATA, "Import Core Data", true));
        params.add(createBooleanSystemSetupParameter(IMPORT_SAMPLE_DATA, "Import Sample Data", true));
        params.add(createBooleanSystemSetupParameter(ACTIVATE_SOLR_CRON_JOBS, "Activate Solr Cron Jobs", true));

        return params;
    }

    /**
     * This method will be called during the system initialization.
     *
     * @param context the context provides the selected parameters and values
     */
    @SystemSetup(type = SystemSetup.Type.PROJECT, process = SystemSetup.Process.ALL)
    public void createProjectData(final SystemSetupContext context) {
        final List<ImportData> importData = new ArrayList<ImportData>();

        final ImportData galloConnectImportData = new ImportData();
        galloConnectImportData.setProductCatalogName(GALLOCONNECT);
        galloConnectImportData.setContentCatalogNames(Arrays.asList(GALLOCONNECT));
        galloConnectImportData.setStoreNames(Arrays.asList(GALLOCONNECT));
        galloConnectImportData.setSiteNames(Arrays.asList(GALLOCONNECT_STANDALONE));
        importData.add(galloConnectImportData);

        getCoreDataImportService().execute(this, context, importData);
        getEventService().publishEvent(new CoreDataImportedEvent(context, importData));

        getGalloConnectSampleDataImportService().execute(this, context, importData);
        getGalloConnectSampleDataImportService().importCommerceOrgData(context);
        getEventService().publishEvent(new SampleDataImportedEvent(context, importData));
    }

    public CoreDataImportService getCoreDataImportService() {
        return coreDataImportService;
    }

    public void setCoreDataImportService(CoreDataImportService coreDataImportService) {
        this.coreDataImportService = coreDataImportService;
    }

    public GalloConnectSampleDataImportService getGalloConnectSampleDataImportService() {
        return galloConnectSampleDataImportService;
    }

    public void setGalloConnectSampleDataImportService(GalloConnectSampleDataImportService galloConnectSampleDataImportService) {
        this.galloConnectSampleDataImportService = galloConnectSampleDataImportService;
    }
}
