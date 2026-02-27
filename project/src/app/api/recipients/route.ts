import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { Country } from "country-state-city";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const page = parseInt(searchParams.get("page") || "1");
  const limitParam = searchParams.get("limit") || "10";
  const isAll = limitParam === "all";
  const limit = isAll ? undefined : parseInt(limitParam);
  const skip = isAll ? 0 : (page - 1) * (limit || 10);

  const status = searchParams.get("status") || undefined;
  const onlyRemote = searchParams.get("onlyRemote") === "true";
  const search = searchParams.get("search")?.trim() || "";
  const sortField = searchParams.get("sortField") || "id";
  const sortOrder = searchParams.get("sortOrder") || "desc";

  const where: any = {};

  if (status) where.ActiveStatus = status;
  if (onlyRemote) where.isRemoteArea = true;

  // Fuzzy search across specific columns only
  if (search) {
    // First, try to find country codes that match the search term
    const matchingCountries = Country.getAllCountries().filter(country =>
      country.name.toLowerCase().includes(search.toLowerCase()) ||
      country.isoCode.toLowerCase().includes(search.toLowerCase())
    );
    
    const countryCodes = matchingCountries.map(country => country.isoCode);
    
    where.OR = [
      { CompanyName: { contains: search, mode: "insensitive" } },
      { PersonName: { contains: search, mode: "insensitive" } },
      { Phone: { contains: search, mode: "insensitive" } },
      { City: { contains: search, mode: "insensitive" } },
      { Country: { contains: search, mode: "insensitive" } },
    ];
    
    // If we found matching country codes, also search for those
    if (countryCodes.length > 0) {
      where.OR.push({ Country: { in: countryCodes } });
    }
  }

  // Validate sort field
  const validSortFields = ["id", "CompanyName", "PersonName", "Phone", "City", "Country", "createdAt"];
  const validSortOrder = ["asc", "desc"];
  
  const finalSortField = validSortFields.includes(sortField) ? sortField : "id";
  const finalSortOrder = validSortOrder.includes(sortOrder) ? sortOrder : "desc";

  const findManyOptions: any = {
    where,
    orderBy: { [finalSortField]: finalSortOrder },
  };

  // Only add skip and take if not fetching all
  if (!isAll) {
    findManyOptions.skip = skip;
    findManyOptions.take = limit;
  }

  const [recipients, total, remoteTotal] = await Promise.all([
    prisma.recipients.findMany(findManyOptions),
    prisma.recipients.count({ where }),
    prisma.recipients.count({ where: { ...where, isRemoteArea: true } }),
  ]);

//   console.log("customers",customers);
  return NextResponse.json({ recipients, total, remoteTotal });
}
