// Real members + zones from the API. Falls back to empty arrays if the
// backend isn't reachable (local mode).
import { useEffect, useState } from "react";
import { api, type ManagedUser, type Zone } from "@/lib/api/client";

export interface DirectoryMember {
  id: string;
  name: string;
  role: string;
  zones: string[];
  adminId?: string | null;
  managerId?: string | null;
}

export function useOrgMembers() {
  const [members, setMembers] = useState<DirectoryMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    let cancelled = false;
    let retryCount = 0;
    const maxRetries = 3;
    
    const fetchMembers = async () => {
      try {
        // Fetch all staff users: members, TCMs, and other staff roles
        const [membersRes, tcmsRes] = await Promise.all([
          api.members.list().catch(() => [] as ManagedUser[]),
          api.tcms.list().catch(() => [] as ManagedUser[]),
        ]);
        
        if (cancelled) return;
        
        // Combine and deduplicate by ID
        const allUsers = [...membersRes, ...tcmsRes];
        const uniqueUsers = Array.from(new Map(allUsers.map(u => [u.id, u])).values());
        
        setMembers(uniqueUsers.map((u: ManagedUser) => ({ 
          id: u.id, 
          name: u.fullName, 
          role: u.role, 
          zones: u.zones || [],
          adminId: u.adminId,
          managerId: u.managerId
        })));
        setError(null);
      } catch (err) {
        if (cancelled) return;
        const error = err as Error;
        console.warn(`[useOrgMembers] Failed to fetch members (attempt ${retryCount + 1}/${maxRetries}):`, error.message);
        
        if (retryCount < maxRetries - 1) {
          retryCount++;
          setTimeout(fetchMembers, Math.pow(2, retryCount) * 1000); // Exponential backoff
          return;
        }
        
        setError(error.message);
        setMembers([]); // Fallback to empty array
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    
    fetchMembers();
    return () => { cancelled = true; };
  }, []);
  
  return { members, loading, error };
}

export function useOrgZones() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    let cancelled = false;
    let retryCount = 0;
    const maxRetries = 3;
    
    const fetchZones = async () => {
      try {
        const list = await api.zones.list();
        if (cancelled) return;
        setZones(list);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        const error = err as Error;
        console.warn(`[useOrgZones] Failed to fetch zones (attempt ${retryCount + 1}/${maxRetries}):`, error.message);
        
        if (retryCount < maxRetries - 1) {
          retryCount++;
          setTimeout(fetchZones, Math.pow(2, retryCount) * 1000); // Exponential backoff
          return;
        }
        
        setError(error.message);
        setZones([]); // Fallback to empty array
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    
    fetchZones();
    return () => { cancelled = true; };
  }, []);
  
  return { zones, loading, error };
}

export function useOrgProperties() {
  const [properties, setProperties] = useState<import("@/lib/types").Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    let cancelled = false;
    let retryCount = 0;
    const maxRetries = 3;
    
    const fetchProperties = async () => {
      try {
        const list = await api.properties.list();
        if (cancelled) return;
        setProperties(list);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        const error = err as Error;
        console.warn(`[useOrgProperties] Failed to fetch properties (attempt ${retryCount + 1}/${maxRetries}):`, error.message);
        
        if (retryCount < maxRetries - 1) {
          retryCount++;
          setTimeout(fetchProperties, Math.pow(2, retryCount) * 1000); // Exponential backoff
          return;
        }
        
        setError(error.message);
        setProperties([]); // Fallback to empty array
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    
    fetchProperties();
    return () => { cancelled = true; };
  }, []);
  
  return { properties, loading, error };
}
