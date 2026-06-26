import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useData } from "@/lib/data-context";
import { useAuth } from "@/lib/auth-context";
import Colors from "@/constants/colors";
import { DailyEntry, SiteMember } from "@/lib/types";

function EntryCard({ entry }: { entry: DailyEntry }) {
  const dateObj = new Date(entry.date + "T00:00:00");
  const dayName = dateObj.toLocaleDateString("en-AU", { weekday: "short" });
  const dayNum = dateObj.getDate();
  const month = dateObj.toLocaleDateString("en-AU", { month: "short" });

  return (
    <Pressable
      style={({ pressed }) => [styles.entryCard, pressed && { opacity: 0.95, transform: [{ scale: 0.99 }] }]}
      onPress={() => router.push({ pathname: "/entry/[id]", params: { id: entry.id } })}
    >
      <View style={styles.entryDate}>
        <Text style={styles.entryDayName}>{dayName}</Text>
        <Text style={styles.entryDayNum}>{dayNum}</Text>
        <Text style={styles.entryMonth}>{month}</Text>
      </View>

      <View style={styles.entryContent}>
        <View style={styles.entryMeta}>
          {!!entry.weather && (
            <View style={styles.metaChip}>
              <Ionicons name="partly-sunny-outline" size={12} color={Colors.accent} />
              <Text style={styles.metaText}>{entry.weather}</Text>
            </View>
          )}
          {!!entry.crewCount && (
            <View style={styles.metaChip}>
              <Ionicons name="people-outline" size={12} color={Colors.accent} />
              <Text style={styles.metaText}>{entry.crewCount} crew</Text>
            </View>
          )}
        </View>
        <Text style={styles.entryNotes} numberOfLines={2}>{entry.notes}</Text>
        {entry.photos.length > 0 && (
          <View style={styles.photoCount}>
            <Ionicons name="camera-outline" size={13} color={Colors.textTertiary} />
            <Text style={styles.photoCountText}>{entry.photos.length} photos</Text>
          </View>
        )}
      </View>

      <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
    </Pressable>
  );
}

export default function SiteDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { getSite, getSiteEntries, deleteSite, getSiteMembers, removeSiteMember } = useData();
  const { user } = useAuth();

  const site = getSite(id);
  const entries = getSiteEntries(id);

  const [members, setMembers] = useState<SiteMember[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);

  const canManage =
    user?.role === "supervisor" ||
    user?.role === "admin";

  useEffect(() => {
    if (!id) return;
    getSiteMembers(id)
      .then((m) => {
        setMembers(m);
        setMembersLoaded(true);
      })
      .catch(() => setMembersLoaded(true));
  }, [id]);

  const handleRemoveMember = (member: SiteMember) => {
    if (!id) return;
    const doRemove = async () => {
      try {
        await removeSiteMember(id, member.memberEmail);
        setMembers((prev) => prev.filter((m) => m.memberEmail !== member.memberEmail));
      } catch (err) {
        Alert.alert("Error", err instanceof Error ? err.message : "Could not remove member.");
      }
    };
    if (Platform.OS === "web") {
      void doRemove();
      return;
    }
    Alert.alert(
      "Remove Member",
      `Remove ${member.memberEmail} from this site?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => void doRemove() },
      ]
    );
  };

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  if (!site) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>Site not found</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backLink}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const handleDelete = () => {
    if (!id) return;
    if (Platform.OS === "web") {
      deleteSite(id);
      router.back();
      return;
    }
    Alert.alert("Delete Site", `Delete "${site.name}" and all its entries?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteSite(id);
          router.back();
        },
      },
    ]);
  };

  const statusColor =
    site.status === "active" ? Colors.success : site.status === "on-hold" ? Colors.warning : Colors.textTertiary;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 8 }]}>
        <View style={styles.headerNav}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color={Colors.white} />
          </Pressable>
          <View style={styles.headerActions}>
            {canManage && (
              <Pressable
                onPress={() =>
                  router.push({ pathname: "/site-invite", params: { siteId: id, siteName: site.name } })
                }
                style={styles.headerAction}
              >
                <Ionicons name="person-add-outline" size={20} color="rgba(255,255,255,0.8)" />
              </Pressable>
            )}
            <Pressable onPress={handleDelete} style={styles.headerAction}>
              <Ionicons name="trash-outline" size={20} color="rgba(255,255,255,0.8)" />
            </Pressable>
          </View>
        </View>

        <Text style={styles.siteName}>{site.name}</Text>
        <View style={styles.headerDetails}>
          <View style={styles.headerDetail}>
            <Ionicons name="person-outline" size={14} color="rgba(255,255,255,0.6)" />
            <Text style={styles.headerDetailText}>{site.client}</Text>
          </View>
          <View style={styles.headerDetail}>
            <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.6)" />
            <Text style={styles.headerDetailText}>{site.address}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{entries.length}</Text>
            <Text style={styles.statLabel}>Entries</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
            <Text style={styles.statLabel}>
              {site.status === "on-hold" ? "On Hold" : site.status.charAt(0).toUpperCase() + site.status.slice(1)}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {new Date(site.startDate).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
            </Text>
            <Text style={styles.statLabel}>Start</Text>
          </View>
        </View>
      </View>

      <View style={styles.actionBar}>
        <Pressable
          style={({ pressed }) => [styles.actionButton, styles.actionPrimary, pressed && { opacity: 0.9 }]}
          onPress={() => router.push({ pathname: "/new-entry", params: { siteId: id } })}
        >
          <Ionicons name="add-circle-outline" size={20} color={Colors.white} />
          <Text style={styles.actionPrimaryText}>New Entry</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.actionButton, styles.actionSecondary, pressed && { opacity: 0.8 }]}
          onPress={() => router.push({ pathname: "/diary/[siteId]", params: { siteId: id } })}
        >
          <Ionicons name="book-outline" size={20} color={Colors.accent} />
          <Text style={styles.actionSecondaryText}>View Diary</Text>
        </Pressable>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <EntryCard entry={item} />}
        contentContainerStyle={[styles.listContent, { paddingBottom: 40 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          membersLoaded && members.length > 0 ? (
            <View style={styles.teamSection}>
              <Text style={styles.teamTitle}>Team</Text>
              {members.map((m) => (
                <View key={m.memberEmail} style={styles.memberRow}>
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberAvatarText}>
                      {m.memberEmail[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberEmail}>{m.memberEmail}</Text>
                    <Text style={styles.memberRole}>
                      {m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                    </Text>
                  </View>
                  {canManage && (
                    <Pressable
                      onPress={() => handleRemoveMember(m)}
                      hitSlop={8}
                    >
                      <Ionicons name="person-remove-outline" size={18} color={Colors.textTertiary} />
                    </Pressable>
                  )}
                </View>
              ))}
              <Text style={styles.entriesHeading}>Entries</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No entries yet</Text>
            <Text style={styles.emptyText}>Add your first daily entry to start building the site diary</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  notFound: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  notFoundText: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  backLink: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.accent,
  },
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  siteName: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: Colors.white,
    marginBottom: 8,
  },
  headerDetails: {
    gap: 4,
    marginBottom: 16,
  },
  headerDetail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerDetailText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.white,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.6)",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  actionBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 46,
    borderRadius: 14,
  },
  actionPrimary: {
    backgroundColor: Colors.accent,
  },
  actionSecondary: {
    backgroundColor: Colors.accent + "14",
  },
  actionPrimaryText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
  },
  actionSecondaryText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.accent,
  },
  listContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  entryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    gap: 14,
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  entryDate: {
    width: 54,
    alignItems: "center",
    backgroundColor: Colors.primary + "0A",
    borderRadius: 12,
    paddingVertical: 8,
  },
  entryDayName: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  entryDayNum: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
  },
  entryMonth: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    textTransform: "uppercase",
  },
  entryContent: {
    flex: 1,
    gap: 6,
  },
  entryMeta: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.accent + "10",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  metaText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.accent,
  },
  entryNotes: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  photoCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  photoCountText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  teamSection: {
    marginBottom: 12,
  },
  teamTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 1,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary + "14",
    alignItems: "center",
    justifyContent: "center",
  },
  memberAvatarText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.primary,
  },
  memberEmail: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  memberRole: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textTertiary,
    marginTop: 2,
  },
  entriesHeading: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 4,
  },
});
