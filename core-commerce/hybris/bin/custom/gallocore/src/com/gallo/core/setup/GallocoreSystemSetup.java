/*
 * Copyright (c) 2021 SAP SE or an SAP affiliate company. All rights reserved.
 */
package com.gallo.core.setup;

import static com.gallo.core.constants.GallocoreConstants.PLATFORM_LOGO_CODE;

import de.hybris.platform.core.initialization.SystemSetup;

import java.io.InputStream;

import com.gallo.core.constants.GallocoreConstants;
import com.gallo.core.service.GallocoreService;


@SystemSetup(extension = GallocoreConstants.EXTENSIONNAME)
public class GallocoreSystemSetup
{
	private final GallocoreService gallocoreService;

	public GallocoreSystemSetup(final GallocoreService gallocoreService)
	{
		this.gallocoreService = gallocoreService;
	}

	@SystemSetup(process = SystemSetup.Process.ALL, type = SystemSetup.Type.ESSENTIAL)
	public void createEssentialData()
	{
		gallocoreService.createLogo(PLATFORM_LOGO_CODE);
	}

	private InputStream getImageStream()
	{
		return GallocoreSystemSetup.class.getResourceAsStream("/gallocore/sap-hybris-platform.png");
	}
}
