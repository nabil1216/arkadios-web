import { useQuery } from '@tanstack/react-query'
import { fetchRoles, fetchStaff, rolesKey, staffKey } from '../api/access'

export const useStaff = () => useQuery({ queryKey: staffKey, queryFn: fetchStaff })
export const useRoles = () => useQuery({ queryKey: rolesKey, queryFn: fetchRoles })
