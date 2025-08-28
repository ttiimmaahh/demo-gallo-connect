/*
 * Copyright (c) 2021 SAP SE or an SAP affiliate company. All rights reserved.
 */
package com.gallo.core.service;

public interface GallocoreService
{
	String getHybrisLogoUrl(String logoCode);

	void createLogo(String logoCode);
}
