/*
 * Copyright (c) 2021 SAP SE or an SAP affiliate company. All rights reserved.
 */
package com.gallo.store.service;

public interface GallostoreService
{
	String getHybrisLogoUrl(String logoCode);

	void createLogo(String logoCode);
}
