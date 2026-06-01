"use client";

import React, { useState, useRef } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  User, 
  Briefcase, 
  Store, 
  ShieldCheck, 
  History, 
  Lock, 
  Camera, 
  Check, 
  Loader2, 
  AlertCircle 
} from "lucide-react";
import { 
  updateBasicProfile, 
  updateEmploymentProfile, 
  updateVendorProfile, 
  updateAccountStatus 
} from "@/server/actions/profile";
import { updateUserProjectAssignments } from "@/server/actions/project-users";
import { useI18n } from "@/lib/i18n";
import { ChangePasswordForm } from "@/components/dashboard/change-password-form";
import { ResetPasswordForm } from "@/components/dashboard/reset-password-form";

interface ProfileShellProps {
  data: {
    user: {
      id: string;
      name: string;
      email: string;
      roleId: string | null;
      roleName: string | null;
      status: string;
      lastLogin: Date | null;
      createdAt: Date;
      image: string | null;
    };
    profile: {
      fullName: string;
      avatarUrl: string | null;
      phone: string | null;
      birthDate: Date | null;
      gender: "male" | "female" | null;
      address: string | null;
      city: string | null;
      province: string | null;
    } | null;
    employment: {
      employeeNumber: string;
      position: string | null;
      department: string | null;
      joinedDate: Date | null;
      employmentStatus: "permanent" | "contract" | "intern" | null;
      supervisorId: string | null;
      workLocation: string | null;
    } | null;
    vendor: {
      vendorCode: string;
      companyName: string;
      picName: string | null;
      picPhone: string | null;
      vendorType: string | null;
      address: string | null;
      status: "active" | "inactive";
    } | null;
    auditLogs: Array<{
      id: string;
      action: string;
      module: string;
      details: any;
      ipAddress: string | null;
      createdAt: Date;
      userName: string | null;
    }>;
    usersList: Array<{ id: string; name: string }>;
  };
  rolesList?: Array<{ id: string; name: string }>;
  isOwnProfile: boolean;
  currentUserRole: string | null;
  isSuperAdmin?: boolean;
  permissions: {
    canUpdateBasic: boolean;
    canUpdateEmployment: boolean;
    canUpdateVendor: boolean;
    canUpdateStatus: boolean;
  };
  allProjects?: Array<{ id: string; name: string }>;
  assignedProjectIds?: string[];
}

export function ProfileShell({
  data,
  rolesList = [],
  isOwnProfile,
  currentUserRole,
  isSuperAdmin = false,
  permissions,
  allProjects = [],
  assignedProjectIds = [],
}: ProfileShellProps) {
  const { user, profile, employment, vendor, auditLogs, usersList } = data;
  const { t } = useI18n();

  const [activeTab, setActiveTab] = useState("profile");

  // State Banners
  const [basicMsg, setBasicMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [employMsg, setEmployMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [vendorMsg, setVendorMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [accessMsg, setAccessMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Loaders
  const [basicLoading, setBasicLoading] = useState(false);
  const [employLoading, setEmployLoading] = useState(false);
  const [vendorLoading, setVendorLoading] = useState(false);
  const [accessLoading, setAccessLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form Fields States
  // Basic
  const [fullName, setFullName] = useState(profile?.fullName || user.name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [birthDate, setBirthDate] = useState(
    profile?.birthDate ? new Date(profile.birthDate).toISOString().split("T")[0] : ""
  );
  const [gender, setGender] = useState<"male" | "female" | "">(profile?.gender || "");
  const [address, setAddress] = useState(profile?.address || "");
  const [city, setCity] = useState(profile?.city || "");
  const [province, setProvince] = useState(profile?.province || "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl || user.image || "");

  // Employment
  const [employeeNumber, setEmployeeNumber] = useState(employment?.employeeNumber || "");
  const [position, setPosition] = useState(employment?.position || "");
  const [department, setDepartment] = useState(employment?.department || "");
  const [joinedDate, setJoinedDate] = useState(
    employment?.joinedDate ? new Date(employment.joinedDate).toISOString().split("T")[0] : ""
  );
  const [employmentStatus, setEmploymentStatus] = useState<"permanent" | "contract" | "intern" | "">(
    employment?.employmentStatus || ""
  );
  const [supervisorId, setSupervisorId] = useState(employment?.supervisorId || "");
  const [workLocation, setWorkLocation] = useState(employment?.workLocation || "");

  // Vendor
  const [vendorCode, setVendorCode] = useState(vendor?.vendorCode || "");
  const [companyName, setCompanyName] = useState(vendor?.companyName || "");
  const [picName, setPicName] = useState(vendor?.picName || "");
  const [picPhone, setPicPhone] = useState(vendor?.picPhone || "");
  const [vendorType, setVendorType] = useState(vendor?.vendorType || "");
  const [vendorAddress, setVendorAddress] = useState(vendor?.address || "");
  const [vendorStatus, setVendorStatus] = useState<"active" | "inactive">(vendor?.status || "active");

  // Account Roles / Status
  const [accountStatus, setAccountStatus] = useState<"active" | "inactive" | "suspended">(
    (user.status as any) || "active"
  );
  const [roleId, setRoleId] = useState(user.roleId || "");

  // Project Assignments
  const [selectedProjects, setSelectedProjects] = useState<string[]>(assignedProjectIds);
  const [projectMsg, setProjectMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [projectLoading, setProjectLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle Avatar File Upload
  const handleAvatarClick = () => {
    if (permissions.canUpdateBasic && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setBasicMsg({ type: "error", text: t("profile_shell.upload_size_error") });
      return;
    }

    setUploading(true);
    setBasicMsg(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(t("profile_shell.upload_failed"));
      }

      const json = await res.json();
      if (json.url) {
        setAvatarUrl(json.url);
        setBasicMsg({ type: "success", text: t("profile_shell.upload_success") });
      }
    } catch (err: any) {
      setBasicMsg({ type: "error", text: err.message || t("profile_shell.upload_error") });
    } finally {
      setUploading(false);
    }
  };

  // Submit Handlers
  const handleBasicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBasicLoading(true);
    setBasicMsg(null);

    try {
      await updateBasicProfile(user.id, {
        fullName,
        phone: phone || null,
        birthDate: birthDate || null,
        gender: gender || null,
        address: address || null,
        city: city || null,
        province: province || null,
        avatarUrl: avatarUrl || null,
      });
      setBasicMsg({ type: "success", text: t("profile_shell.basic_saved") });
    } catch (err: any) {
      setBasicMsg({ type: "error", text: err.message || t("profile_shell.basic_save_failed") });
    } finally {
      setBasicLoading(false);
    }
  };

  const handleEmploymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmployLoading(true);
    setEmployMsg(null);

    try {
      await updateEmploymentProfile(user.id, {
        employeeNumber,
        position: position || null,
        department: department || null,
        joinedDate: joinedDate || null,
        employmentStatus: employmentStatus || null,
        supervisorId: supervisorId || null,
        workLocation: workLocation || null,
      });
      setEmployMsg({ type: "success", text: t("profile_shell.employ_saved") });
    } catch (err: any) {
      setEmployMsg({ type: "error", text: err.message || t("profile_shell.employ_save_failed") });
    } finally {
      setEmployLoading(false);
    }
  };

  const handleVendorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVendorLoading(true);
    setVendorMsg(null);

    try {
      await updateVendorProfile(user.id, {
        vendorCode,
        companyName,
        picName: picName || null,
        picPhone: picPhone || null,
        vendorType: vendorType || null,
        address: vendorAddress || null,
        status: vendorStatus,
      });
      setVendorMsg({ type: "success", text: t("profile_shell.vendor_saved") });
    } catch (err: any) {
      setVendorMsg({ type: "error", text: err.message || t("profile_shell.vendor_save_failed") });
    } finally {
      setVendorLoading(false);
    }
  };

  const handleAccessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccessLoading(true);
    setAccessMsg(null);

    try {
      await updateAccountStatus(user.id, {
        status: accountStatus,
        roleId,
      });
      setAccessMsg({ type: "success", text: t("profile_shell.access_saved") });
    } catch (err: any) {
      setAccessMsg({ type: "error", text: err.message || t("profile_shell.access_save_failed") });
    } finally {
      setAccessLoading(false);
    }
  };

  // Determine user initials
  const initials = fullName
    ? fullName.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()
    : user.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Header Profile Banner card */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-secondary/30 via-secondary/10 to-transparent border border-border/80 p-6 md:p-8">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
            <Avatar className="h-24 w-24 border-4 border-card shadow-lg bg-emerald-50 text-primary font-bold text-2xl">
              <AvatarImage src={avatarUrl || ""} alt={fullName} className="object-cover" />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            {permissions.canUpdateBasic && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                {uploading ? (
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                ) : (
                  <Camera className="h-6 w-6 text-white" />
                )}
              </div>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileChange}
              disabled={uploading} 
            />
          </div>
          <div className="flex-1 text-center md:text-left space-y-1.5">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{fullName || user.name}</h1>
              <Badge className="bg-[#8FAF9A] text-white hover:bg-[#8FAF9A]/95 text-[10px] font-bold px-2 py-0.5 tracking-wider uppercase">
                {user.roleName || t("profile_shell.no_role")}
              </Badge>
              {user.status === "active" ? (
                <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 text-[10px] px-2">
                  {t("profile_shell.status_active")}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-rose-600 border-rose-200 bg-rose-50 text-[10px] px-2">
                  {user.status === "suspended" ? t("profile_shell.status_suspended") : t("profile_shell.status_inactive")}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground font-medium">{user.email}</p>
            <p className="text-xs text-muted-foreground">
              {t("profile_shell.registered_since")} {new Date(user.createdAt).toLocaleDateString("id-ID", { dateStyle: "long" })}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 md:flex md:w-auto bg-slate-100 p-1 rounded-xl gap-1 border">
          <TabsTrigger value="profile" className="flex items-center gap-1.5 px-4 py-2 font-medium">
            <User className="h-4 w-4" />
            {t("profile_shell.tab_profile")}
          </TabsTrigger>
          <TabsTrigger value="employment" className="flex items-center gap-1.5 px-4 py-2 font-medium">
            <Briefcase className="h-4 w-4" />
            {t("profile_shell.tab_employment")}
          </TabsTrigger>
          {/* Only show Vendor tab if user has role Vendor, or if they have a vendor record */}
          {(user.roleId === "role_vendor" || vendor !== null) && (
            <TabsTrigger value="vendor" className="flex items-center gap-1.5 px-4 py-2 font-medium">
              <Store className="h-4 w-4" />
              {t("profile_shell.tab_vendor")}
            </TabsTrigger>
          )}
          <TabsTrigger value="access" className="flex items-center gap-1.5 px-4 py-2 font-medium">
            <ShieldCheck className="h-4 w-4" />
            {t("profile_shell.tab_access")}
          </TabsTrigger>
          {(isSuperAdmin && user.roleId === "role_pengawas") && (
            <TabsTrigger value="projects" className="flex items-center gap-1.5 px-4 py-2 font-medium">
              <Briefcase className="h-4 w-4" />
              Penugasan Proyek
            </TabsTrigger>
          )}
          <TabsTrigger value="logs" className="flex items-center gap-1.5 px-4 py-2 font-medium">
            <History className="h-4 w-4" />
            {t("profile_shell.tab_logs")}
          </TabsTrigger>
          {(isOwnProfile || isSuperAdmin) && (
            <TabsTrigger value="security" className="flex items-center gap-1.5 px-4 py-2 font-medium">
              <Lock className="h-4 w-4" />
              {t("profile_shell.tab_security")}
            </TabsTrigger>
          )}
        </TabsList>

        {/* ==================== TAB 1: BASIC PROFILE ==================== */}
        <TabsContent value="profile" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-lg">
                <span>{t("profile_shell.basic_title")}</span>
                {!permissions.canUpdateBasic && <Lock className="h-4 w-4 text-muted-foreground" />}
              </CardTitle>
              <CardDescription>
                {t("profile_shell.basic_desc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleBasicSubmit} className="space-y-4">
                {basicMsg && (
                  <div className={`p-3 rounded-lg flex items-center gap-2.5 text-xs font-semibold ${
                    basicMsg.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
                  }`}>
                    {basicMsg.type === "error" && <AlertCircle className="h-4 w-4 shrink-0" />}
                    <span>{basicMsg.text}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName">{t("profile_shell.field_fullname")}</Label>
                    <Input 
                      id="fullName" 
                      value={fullName} 
                      onChange={e => setFullName(e.target.value)} 
                      disabled={!permissions.canUpdateBasic || basicLoading}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">{t("profile_shell.field_phone")}</Label>
                    <Input 
                      id="phone" 
                      value={phone} 
                      placeholder={t("profile_shell.field_phone_ph")}
                      onChange={e => setPhone(e.target.value)} 
                      disabled={!permissions.canUpdateBasic || basicLoading}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="birthDate">{t("profile_shell.field_birthdate")}</Label>
                    <Input 
                      id="birthDate" 
                      type="date"
                      value={birthDate} 
                      onChange={e => setBirthDate(e.target.value)} 
                      disabled={!permissions.canUpdateBasic || basicLoading}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="gender">{t("profile_shell.field_gender")}</Label>
                    <Select
                      value={gender || "none"}
                      onValueChange={(val) => setGender(val === "none" || !val ? "" : (val as any))}
                      items={[
                        { label: t("profile_shell.gender_choose"), value: "none" },
                        { label: t("profile_shell.gender_male"), value: "male" },
                        { label: t("profile_shell.gender_female"), value: "female" }
                      ]}
                      disabled={!permissions.canUpdateBasic || basicLoading}
                    >
                      <SelectTrigger className="w-full h-8 text-xs border-border rounded-xl focus:ring-2 focus:ring-primary/20 bg-card text-foreground transition-premium">
                        <SelectValue placeholder={t("profile_shell.gender_choose")}>
                          {gender === "male" && t("profile_shell.gender_male")}
                          {gender === "female" && t("profile_shell.gender_female")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="border-[#D6DED2] rounded-xl bg-white/95 backdrop-blur-md">
                        <SelectItem value="none" className="text-xs">{t("profile_shell.gender_choose")}</SelectItem>
                        <SelectItem value="male" className="text-xs">{t("profile_shell.gender_male")}</SelectItem>
                        <SelectItem value="female" className="text-xs">{t("profile_shell.gender_female")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="address">{t("profile_shell.field_address")}</Label>
                  <textarea
                    id="address"
                    value={address}
                    rows={2}
                    onChange={e => setAddress(e.target.value)}
                    disabled={!permissions.canUpdateBasic || basicLoading}
                    className="flex w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:bg-input/50 disabled:opacity-50 min-h-[60px] dark:bg-slate-900/30"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="city">{t("profile_shell.field_city")}</Label>
                    <Input 
                      id="city" 
                      value={city} 
                      onChange={e => setCity(e.target.value)} 
                      disabled={!permissions.canUpdateBasic || basicLoading}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="province">{t("profile_shell.field_province")}</Label>
                    <Input 
                      id="province" 
                      value={province} 
                      onChange={e => setProvince(e.target.value)} 
                      disabled={!permissions.canUpdateBasic || basicLoading}
                    />
                  </div>
                </div>

                {permissions.canUpdateBasic && (
                  <Button type="submit" className="bg-[#8FAF9A] hover:bg-[#8FAF9A]/90 text-white font-medium text-xs h-8 px-4" disabled={basicLoading}>
                    {basicLoading ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        {t("profile_shell.saving")}
                      </>
                    ) : (
                      <>
                        <Check className="mr-1.5 h-3.5 w-3.5" />
                        {t("profile_shell.save_basic")}
                      </>
                    )}
                  </Button>
                )}
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== TAB 2: EMPLOYMENT PROFILE ==================== */}
        <TabsContent value="employment" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-lg">
                <span>{t("profile_shell.employ_title")}</span>
                {!permissions.canUpdateEmployment && <Lock className="h-4 w-4 text-muted-foreground" />}
              </CardTitle>
              <CardDescription>
                {t("profile_shell.employ_desc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleEmploymentSubmit} className="space-y-4">
                {employMsg && (
                  <div className={`p-3 rounded-lg flex items-center gap-2.5 text-xs font-semibold ${
                    employMsg.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
                  }`}>
                    {employMsg.type === "error" && <AlertCircle className="h-4 w-4 shrink-0" />}
                    <span>{employMsg.text}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="employeeNumber">{t("profile_shell.field_emp_number")}</Label>
                    <Input 
                      id="employeeNumber" 
                      placeholder={t("profile_shell.field_emp_number_ph")}
                      value={employeeNumber} 
                      onChange={e => setEmployeeNumber(e.target.value)} 
                      disabled={!permissions.canUpdateEmployment || employLoading}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="position">{t("profile_shell.field_position")}</Label>
                    <Input 
                      id="position" 
                      placeholder={t("profile_shell.field_position_ph")}
                      value={position} 
                      onChange={e => setPosition(e.target.value)} 
                      disabled={!permissions.canUpdateEmployment || employLoading}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="department">{t("profile_shell.field_department")}</Label>
                    <Input 
                      id="department" 
                      placeholder={t("profile_shell.field_department_ph")}
                      value={department} 
                      onChange={e => setDepartment(e.target.value)} 
                      disabled={!permissions.canUpdateEmployment || employLoading}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="employmentStatus">{t("profile_shell.field_emp_status")}</Label>
                    <Select
                      value={employmentStatus || "none"}
                      onValueChange={(val) => setEmploymentStatus(val === "none" || !val ? "" : (val as any))}
                      items={[
                        { label: t("profile_shell.gender_choose"), value: "none" },
                        { label: t("profile_shell.emp_permanent"), value: "permanent" },
                        { label: t("profile_shell.emp_contract"), value: "contract" },
                        { label: t("profile_shell.emp_intern"), value: "intern" }
                      ]}
                      disabled={!permissions.canUpdateEmployment || employLoading}
                    >
                      <SelectTrigger className="w-full h-8 text-xs border-border rounded-xl focus:ring-2 focus:ring-primary/20 bg-card text-foreground transition-premium">
                        <SelectValue placeholder={t("profile_shell.gender_choose")}>
                          {employmentStatus === "permanent" && t("profile_shell.emp_permanent")}
                          {employmentStatus === "contract" && t("profile_shell.emp_contract")}
                          {employmentStatus === "intern" && t("profile_shell.emp_intern")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="border-[#D6DED2] rounded-xl bg-white/95 backdrop-blur-md">
                        <SelectItem value="none" className="text-xs">{t("profile_shell.gender_choose")}</SelectItem>
                        <SelectItem value="permanent" className="text-xs">{t("profile_shell.emp_permanent")}</SelectItem>
                        <SelectItem value="contract" className="text-xs">{t("profile_shell.emp_contract")}</SelectItem>
                        <SelectItem value="intern" className="text-xs">{t("profile_shell.emp_intern")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="joinedDate">{t("profile_shell.field_joined_date")}</Label>
                    <Input 
                      id="joinedDate" 
                      type="date"
                      value={joinedDate} 
                      onChange={e => setJoinedDate(e.target.value)} 
                      disabled={!permissions.canUpdateEmployment || employLoading}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="supervisorId">{t("profile_shell.field_supervisor")}</Label>
                    <Select
                      value={supervisorId || "none"}
                      onValueChange={(val) => setSupervisorId(val === "none" || !val ? "" : val)}
                      items={[
                        { label: t("profile_shell.supervisor_ph"), value: "none" },
                        ...usersList.map(u => ({ label: u.name, value: u.id }))
                      ]}
                      disabled={!permissions.canUpdateEmployment || employLoading}
                    >
                      <SelectTrigger className="w-full h-8 text-xs border-border rounded-xl focus:ring-2 focus:ring-primary/20 bg-card text-foreground transition-premium">
                        <SelectValue placeholder={t("profile_shell.supervisor_ph")}>
                          {supervisorId && supervisorId !== "none" ? usersList.find(u => u.id === supervisorId)?.name : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="border-[#D6DED2] rounded-xl bg-white/95 backdrop-blur-md">
                        <SelectItem value="none" className="text-xs">{t("profile_shell.supervisor_ph")}</SelectItem>
                        {usersList.map((u) => (
                          <SelectItem key={u.id} value={u.id} className="text-xs">
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="workLocation">{t("profile_shell.field_work_location")}</Label>
                  <Input 
                    id="workLocation" 
                    placeholder={t("profile_shell.field_work_location_ph")}
                    value={workLocation} 
                    onChange={e => setWorkLocation(e.target.value)} 
                    disabled={!permissions.canUpdateEmployment || employLoading}
                  />
                </div>

                {permissions.canUpdateEmployment && (
                  <Button type="submit" className="bg-[#8FAF9A] hover:bg-[#8FAF9A]/90 text-white font-medium text-xs h-8 px-4" disabled={employLoading}>
                    {employLoading ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        {t("profile_shell.saving")}
                      </>
                    ) : (
                      <>
                        <Check className="mr-1.5 h-3.5 w-3.5" />
                        {t("profile_shell.save_basic")}
                      </>
                    )}
                  </Button>
                )}
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== TAB 3: VENDOR PROFILE ==================== */}
        <TabsContent value="vendor" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-lg">
                <span>{t("profile_shell.vendor_title")}</span>
                {!permissions.canUpdateVendor && <Lock className="h-4 w-4 text-muted-foreground" />}
              </CardTitle>
              <CardDescription>
                {t("profile_shell.vendor_desc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleVendorSubmit} className="space-y-4">
                {vendorMsg && (
                  <div className={`p-3 rounded-lg flex items-center gap-2.5 text-xs font-semibold ${
                    vendorMsg.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
                  }`}>
                    {vendorMsg.type === "error" && <AlertCircle className="h-4 w-4 shrink-0" />}
                    <span>{vendorMsg.text}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="vendorCode">{t("profile_shell.field_vendor_code")}</Label>
                    <Input 
                      id="vendorCode" 
                      placeholder={t("profile_shell.field_vendor_code_ph")}
                      value={vendorCode} 
                      onChange={e => setVendorCode(e.target.value)} 
                      disabled={!permissions.canUpdateVendor || vendorLoading}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="companyName">{t("profile_shell.field_company_name")}</Label>
                    <Input 
                      id="companyName" 
                      placeholder={t("profile_shell.field_company_name_ph")}
                      value={companyName} 
                      onChange={e => setCompanyName(e.target.value)} 
                      disabled={!permissions.canUpdateVendor || vendorLoading}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="picName">{t("profile_shell.field_pic_name")}</Label>
                    <Input 
                      id="picName" 
                      placeholder={t("profile_shell.field_pic_name_ph")}
                      value={picName} 
                      onChange={e => setPicName(e.target.value)} 
                      disabled={!permissions.canUpdateVendor && !isOwnProfile}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="picPhone">{t("profile_shell.field_pic_phone")}</Label>
                    <Input 
                      id="picPhone" 
                      placeholder={t("profile_shell.field_pic_phone_ph")}
                      value={picPhone} 
                      onChange={e => setPicPhone(e.target.value)} 
                      disabled={!permissions.canUpdateVendor && !isOwnProfile}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="vendorType">{t("profile_shell.field_vendor_type")}</Label>
                    <Input 
                      id="vendorType" 
                      placeholder={t("profile_shell.field_vendor_type_ph")}
                      value={vendorType} 
                      onChange={e => setVendorType(e.target.value)} 
                      disabled={!permissions.canUpdateVendor || vendorLoading}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="vendorStatus">{t("profile_shell.field_vendor_status")}</Label>
                    <Select
                      value={vendorStatus}
                      onValueChange={(val) => setVendorStatus(val as any)}
                      items={[
                        { label: t("profile_shell.vendor_active"), value: "active" },
                        { label: t("profile_shell.vendor_inactive"), value: "inactive" }
                      ]}
                      disabled={!permissions.canUpdateVendor || vendorLoading}
                    >
                      <SelectTrigger className="w-full h-8 text-xs border-border rounded-xl focus:ring-2 focus:ring-primary/20 bg-card text-foreground transition-premium">
                        <SelectValue placeholder={t("profile_shell.field_vendor_status")}>
                          {vendorStatus === "active" && t("profile_shell.vendor_active")}
                          {vendorStatus === "inactive" && t("profile_shell.vendor_inactive")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="border-[#D6DED2] rounded-xl bg-white/95 backdrop-blur-md">
                        <SelectItem value="active" className="text-xs">{t("profile_shell.vendor_active")}</SelectItem>
                        <SelectItem value="inactive" className="text-xs">{t("profile_shell.vendor_inactive")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="vendorAddress">{t("profile_shell.field_vendor_address")}</Label>
                  <textarea
                    id="vendorAddress"
                    value={vendorAddress}
                    rows={2}
                    onChange={e => setVendorAddress(e.target.value)}
                    disabled={!permissions.canUpdateVendor || vendorLoading}
                    className="flex w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:bg-input/50 disabled:opacity-50 min-h-[60px] dark:bg-slate-900/30"
                  />
                </div>

                {(permissions.canUpdateVendor || isOwnProfile) && (
                  <Button type="submit" className="bg-[#8FAF9A] hover:bg-[#8FAF9A]/90 text-white font-medium text-xs h-8 px-4" disabled={vendorLoading}>
                    {vendorLoading ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        {t("profile_shell.saving")}
                      </>
                    ) : (
                      <>
                        <Check className="mr-1.5 h-3.5 w-3.5" />
                        {t("profile_shell.save_basic")}
                      </>
                    )}
                  </Button>
                )}
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== TAB 4: ROLE & ACCESS ==================== */}
        <TabsContent value="access" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-lg">
                <span>{t("profile_shell.access_title")}</span>
                {!permissions.canUpdateStatus && <Lock className="h-4 w-4 text-muted-foreground" />}
              </CardTitle>
              <CardDescription>
                {t("profile_shell.access_desc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAccessSubmit} className="space-y-5">
                {accessMsg && (
                  <div className={`p-3 rounded-lg flex items-center gap-2.5 text-xs font-semibold ${
                    accessMsg.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
                  }`}>
                    {accessMsg.type === "error" && <AlertCircle className="h-4 w-4 shrink-0" />}
                    <span>{accessMsg.text}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-900/10 p-5 rounded-xl border">
                  <div className="space-y-1.5">
                    <Label htmlFor="accountEmail" className="text-slate-500 text-xs">{t("profile_shell.field_email_fixed")}</Label>
                    <div className="h-8 w-full border border-slate-200 rounded-lg px-2.5 flex items-center text-sm font-semibold bg-slate-100 text-slate-500 font-sans cursor-not-allowed">
                      {user.email}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="lastLogin" className="text-slate-500 text-xs">{t("profile_shell.field_last_login")}</Label>
                    <div className="h-8 w-full border border-slate-200 rounded-lg px-2.5 flex items-center text-sm font-medium bg-slate-100 text-slate-500 font-mono cursor-not-allowed">
                      {user.lastLogin 
                        ? new Date(user.lastLogin).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) 
                        : t("profile_shell.never_logged_in")}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="roleSelect">{t("profile_shell.field_role")}</Label>
                    <Select
                      value={roleId || "none"}
                      onValueChange={(val) => setRoleId(val === "none" || !val ? "" : val)}
                      items={[
                        { label: t("profile_shell.role_none"), value: "none" },
                        ...rolesList.map(r => ({ label: r.name, value: r.id }))
                      ]}
                      disabled={!permissions.canUpdateStatus || accessLoading}
                    >
                      <SelectTrigger className="w-full h-8 text-xs border-border rounded-xl focus:ring-2 focus:ring-primary/20 bg-card text-foreground transition-premium">
                        <SelectValue placeholder={t("profile_shell.role_choose")}>
                          {roleId && roleId !== "none" ? rolesList.find(r => r.id === roleId)?.name : t("profile_shell.role_none")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="border-[#D6DED2] rounded-xl bg-white/95 backdrop-blur-md">
                        <SelectItem value="none" className="text-xs">{t("profile_shell.role_none")}</SelectItem>
                        {rolesList.map((r) => (
                          <SelectItem key={r.id} value={r.id} className="text-xs">
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="statusSelect">{t("profile_shell.field_account_status")}</Label>
                    <Select
                      value={accountStatus}
                      onValueChange={(val) => setAccountStatus(val as any)}
                      items={[
                        { label: t("profile_shell.status_option_active"), value: "active" },
                        { label: t("profile_shell.status_option_inactive"), value: "inactive" },
                        { label: t("profile_shell.status_option_suspended"), value: "suspended" }
                      ]}
                      disabled={!permissions.canUpdateStatus || accessLoading}
                    >
                      <SelectTrigger className="w-full h-8 text-xs border-border rounded-xl focus:ring-2 focus:ring-primary/20 bg-card text-foreground transition-premium">
                        <SelectValue placeholder={t("profile_shell.role_choose")}>
                          {accountStatus === "active" && t("profile_shell.status_option_active")}
                          {accountStatus === "inactive" && t("profile_shell.status_option_inactive")}
                          {accountStatus === "suspended" && t("profile_shell.status_option_suspended")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="border-[#D6DED2] rounded-xl bg-white/95 backdrop-blur-md">
                        <SelectItem value="active" className="text-xs">{t("profile_shell.status_option_active")}</SelectItem>
                        <SelectItem value="inactive" className="text-xs">{t("profile_shell.status_option_inactive")}</SelectItem>
                        <SelectItem value="suspended" className="text-xs">{t("profile_shell.status_option_suspended")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {permissions.canUpdateStatus && (
                  <Button type="submit" className="bg-[#8FAF9A] hover:bg-[#8FAF9A]/90 text-white font-medium text-xs h-8 px-4" disabled={accessLoading}>
                    {accessLoading ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        {t("profile_shell.saving_access")}
                      </>
                    ) : (
                      <>
                        <Check className="mr-1.5 h-3.5 w-3.5" />
                        {t("profile_shell.save_access")}
                      </>
                    )}
                  </Button>
                )}
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== TAB 5: AUDIT LOGS ==================== */}
        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("profile_shell.logs_title")}</CardTitle>
              <CardDescription>
                {t("profile_shell.logs_desc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  {t("profile_shell.logs_empty")}
                </div>
              ) : (
                <div className="relative border-l border-slate-200 dark:border-slate-800 ml-4 pl-6 space-y-6">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="relative">
                      {/* Timeline dot */}
                      <span className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-card shadow-sm ring-4 ring-muted">
                        <History className="h-2 w-2 text-slate-400" />
                      </span>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                            {log.action.replace("_", " ")}
                          </span>
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-semibold tracking-wider font-mono">
                            MODULE: {log.module.toUpperCase()}
                          </Badge>
                        </div>
                        {log.details && (
                          <pre className="text-[11px] font-mono bg-slate-50 dark:bg-slate-900/35 border p-2 rounded-lg text-slate-500 overflow-x-auto max-w-full">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        )}
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
                          <span className="font-semibold font-mono">{log.ipAddress || "no-ip"}</span>
                          <span>•</span>
                          <span>
                            {new Date(log.createdAt).toLocaleString("id-ID", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== TAB: PROJECT ASSIGNMENTS ==================== */}
        {(isSuperAdmin && user.roleId === "role_pengawas") && (
          <TabsContent value="projects" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Penugasan Proyek Pengawas</CardTitle>
                <CardDescription>
                  Pilih proyek perumahan yang diawasi oleh pengawas lapangan {fullName || user.name}. Penugasan ini membatasi data SPK dan progres konstruksi yang dapat diakses di portal mereka.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setProjectLoading(true);
                    setProjectMsg(null);
                    try {
                      await updateUserProjectAssignments(user.id, selectedProjects);
                      setProjectMsg({ type: "success", text: "Penugasan proyek berhasil diperbarui!" });
                    } catch (err: any) {
                      setProjectMsg({ type: "error", text: err.message || "Gagal memperbarui penugasan proyek." });
                    } finally {
                      setProjectLoading(false);
                    }
                  }} 
                  className="space-y-4"
                >
                  {projectMsg && (
                    <div className={`p-3 rounded-lg flex items-center gap-2.5 text-xs font-semibold ${
                      projectMsg.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
                    }`}>
                      {projectMsg.type === "error" && <AlertCircle className="h-4 w-4 shrink-0" />}
                      <span>{projectMsg.text}</span>
                    </div>
                  )}

                  {allProjects && allProjects.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-900/10 p-5 rounded-xl border">
                      {allProjects.map((p) => {
                        const isChecked = selectedProjects.includes(p.id);
                        return (
                          <label 
                            key={p.id} 
                            className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border rounded-xl hover:bg-slate-50 cursor-pointer shadow-sm transition-all"
                          >
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSelectedProjects(prev => prev.filter(id => id !== p.id));
                                } else {
                                  setSelectedProjects(prev => [...prev, p.id]);
                                }
                              }}
                              className="h-4.5 w-4.5 rounded text-primary focus:ring-primary border-slate-300 transition-colors"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{p.name}</p>
                              <p className="text-[10px] text-slate-400 font-semibold font-mono tracking-wider mt-0.5">ID: {p.id.substring(0, 8).toUpperCase()}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-xs font-semibold bg-slate-50 border rounded-2xl">
                      Tidak ada proyek aktif di database.
                    </div>
                  )}

                  <Button 
                    type="submit" 
                    className="bg-[#4F6F52] hover:bg-[#3D563F] text-white font-medium text-xs h-8 px-4" 
                    disabled={projectLoading}
                  >
                    {projectLoading ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <Check className="mr-1.5 h-3.5 w-3.5" />
                        Simpan Penugasan Proyek
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ==================== TAB 6: SECURITY / PASSWORD ==================== */}
        {(isOwnProfile || isSuperAdmin) && (
          <TabsContent value="security" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {isOwnProfile ? t("profile_shell.security_title") : "Reset Password Akun"}
                </CardTitle>
                <CardDescription>
                  {isOwnProfile 
                    ? t("profile_shell.security_desc") 
                    : `Atur ulang password untuk akun ${fullName || user.name}.`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isOwnProfile ? (
                  <ChangePasswordForm userId={user.id} />
                ) : (
                  <ResetPasswordForm userId={user.id} userName={fullName || user.name} />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
