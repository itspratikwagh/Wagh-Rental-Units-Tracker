import { PrismaClient, Tenant } from '@prisma/client'

const prisma = new PrismaClient()

async function getPropertyData() {
  const property = await prisma.property.findFirst({
    include: {
      tenants: true,
    },
  })
  return property
}

export default async function Home() {
  const property = await getPropertyData()

  if (!property) {
    return <div>No property found</div>
  }

  const totalMonthlyRent = property.tenants.reduce((sum: number, tenant: Tenant) => sum + tenant.rentAmount, 0)

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Property Overview</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Address</p>
            <p className="text-lg font-medium">{property.address}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Location</p>
            <p className="text-lg font-medium">{property.city}, {property.province} {property.postalCode}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Monthly Rent</p>
            <p className="text-lg font-medium text-green-600">${totalMonthlyRent}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Tenants</p>
            <p className="text-lg font-medium">{property.tenants.length}</p>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Tenants</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lease Start</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monthly Rent</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {property.tenants.map((tenant: Tenant) => (
                <tr key={tenant.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {tenant.firstName} {tenant.lastName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {tenant.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(tenant.leaseStart).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${tenant.rentAmount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
} 