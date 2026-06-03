import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Crypto from "expo-crypto";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useData } from "@/lib/data-context";
import Colors from "@/constants/colors";
import { Photo } from "@/lib/types";
import { AddressSuggestion, fetchAddressSuggestions } from "@/lib/geo";
import { fetchCurrentWeather, formatWeatherString } from "@/lib/weather";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiBaseUrl } from "@/lib/api-base-url";
import Svg, { Path as SvgPath } from "react-native-svg";
import { consumePendingAnnotation } from "@/lib/annotationStore";

type AnnotationPath = { d: string; color: string; width: number };
type PhotoWithBase64 = Photo & { base64?: string | null; annotationPaths?: AnnotationPath[] };

const TIME_CODE_OPTIONS = ["ST", "OT", "DT", "SL"];
type EntryTemplate = { id: string; name: string; notes: string; crewCount: string; weather: string };

async function fetchTemplates(): Promise<EntryTemplate[]> {
  try {
    const token = await AsyncStorage.getItem("sitesnap.token");
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/entry-templates`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { templates: EntryTemplate[] };
    return data.templates;
  } catch {
    return [];
  }
}

function normalizeImageMimeType(_mimeType?: string | null) {
  return "image/jpeg";
}

async function createStoredPhoto(asset: ImagePicker.ImagePickerAsset): Promise<PhotoWithBase64> {
  const manipulated = await manipulateAsync(
    asset.uri,
    [],
    {
      compress: 0.55,
      format: SaveFormat.JPEG,
      base64: true,
    }
  );

  return {
    id: Crypto.randomUUID(),
    uri: manipulated.uri,
    caption: "",
    timestamp: new Date().toISOString(),
    base64: manipulated.base64 || asset.base64 || "",
    mimeType: normalizeImageMimeType(asset.mimeType),
  };
}

export default function NewEntryScreen() {
  const { siteId, entryId } = useLocalSearchParams<{ siteId: string; entryId?: string }>();
  const { addEntry, updateEntry, getSite, getEntry } = useData();
  const existingEntry = entryId ? getEntry(entryId) : undefined;
  const site = getSite(existingEntry?.siteId ?? siteId);
  const [date, setDate] = useState(existingEntry?.date ?? new Date().toISOString().split("T")[0]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateDraft, setDateDraft] = useState(new Date(`${new Date().toISOString().split("T")[0]}T00:00:00`));
  const [weather, setWeather] = useState("");
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [locationAddress, setLocationAddress] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [crewCount, setCrewCount] = useState("");
  const [timeCode, setTimeCode] = useState("");
  const [hoursWorked, setHoursWorked] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<PhotoWithBase64[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pickingPhoto, setPickingPhoto] = useState(false);
  const isEditing = Boolean(entryId);

  // Consume annotation written by draw-photo screen when we come back into focus
  useFocusEffect(
    useCallback(() => {
      const annotation = consumePendingAnnotation();
      if (!annotation) return;
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === annotation.photoId
            ? { ...p, annotationPaths: annotation.paths }
            : p
        )
      );
    }, [])
  );

  const weatherOptions = ["Sunny", "Partly Cloudy", "Overcast", "Rain", "Storm", "Windy"];

  const autoFillWeather = async () => {
    setWeatherLoading(true);
    try {
      const result = await fetchCurrentWeather();
      if (result) {
        setWeather(formatWeatherString(result));
      }
    } finally {
      setWeatherLoading(false);
    }
  };

  const [templates, setTemplates] = useState<EntryTemplate[]>([]);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  useEffect(() => {
    if (!isEditing) fetchTemplates().then(setTemplates);
  }, [isEditing]);

  const applyTemplate = (tpl: EntryTemplate) => {
    if (tpl.notes) setNotes(tpl.notes);
    if (tpl.crewCount) setCrewCount(tpl.crewCount);
    if (tpl.weather) setWeather(tpl.weather);
    setShowTemplatePicker(false);
  };

  const [cameraPermission, requestCameraPermission] = ImagePicker.useCameraPermissions();

  useEffect(() => {
    if (!existingEntry) return;
    setDate(existingEntry.date);
    setWeather(existingEntry.weather);
    setLocationAddress(existingEntry.locationAddress ?? "");
    setCrewCount(existingEntry.crewCount);
    setTimeCode(existingEntry.timeCode ?? "");
    setHoursWorked(existingEntry.hoursWorked ?? "");
    setNotes(existingEntry.notes);
    setPhotos(existingEntry.photos as PhotoWithBase64[]);
  }, [existingEntry]);

  useEffect(() => {
    let isCancelled = false;
    const q = locationAddress.trim();
    if (q.length < 3) {
      setAddressSuggestions([]);
      setAddressLoading(false);
      return;
    }

    setAddressLoading(true);
    const timer = setTimeout(async () => {
      try {
        const suggestions = await fetchAddressSuggestions(q);
        if (!isCancelled) {
          setAddressSuggestions(suggestions);
        }
      } catch (error) {
        if (!isCancelled) {
          console.error("Address suggestions failed:", error);
          setAddressSuggestions([]);
        }
      } finally {
        if (!isCancelled) {
          setAddressLoading(false);
        }
      }
    }, 250);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [locationAddress]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!notes.trim()) newErrors.notes = "Notes are required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS !== "ios") {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      if (Platform.OS === "ios") {
        setDateDraft(selectedDate);
      } else {
        setDate(selectedDate.toISOString().split("T")[0]);
      }
    }
  };

  const openDatePicker = () => {
    const current = new Date(`${date}T00:00:00`);
    setDateDraft(current);
    setShowDatePicker(true);
  };

  const applyDateDraft = () => {
    setDate(dateDraft.toISOString().split("T")[0]);
    setShowDatePicker(false);
  };

  const formattedDate = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const formattedDraftDate = dateDraft.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const handleTakePhoto = async () => {
    if (pickingPhoto) return;
    setPickingPhoto(true);
    try {
      if (!cameraPermission?.granted) {
        const result = await requestCameraPermission();
        if (!result.granted) {
          Alert.alert("Permission Required", "Camera access is needed to take photos.");
          setPickingPhoto(false);
          return;
        }
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.35,
        base64: true,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        const newPhoto = await createStoredPhoto(result.assets[0]);
        setPhotos((prev) => [...prev, newPhoto]);
      }
    } catch (err) {
      console.error("Camera error:", err);
    }
    setPickingPhoto(false);
  };

  const handlePickFromGallery = async () => {
    if (pickingPhoto) return;
    setPickingPhoto(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.35,
        base64: true,
        allowsMultipleSelection: true,
        selectionLimit: 0,
      });

      if (!result.canceled && result.assets.length > 0) {
        const newPhotos: Photo[] = await Promise.all(result.assets.map((asset) => createStoredPhoto(asset)));
        setPhotos((prev) => [...prev, ...newPhotos]);
      }
    } catch (err) {
      console.error("Gallery error:", err);
    }
    setPickingPhoto(false);
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSave = async () => {
    if (!validate()) return;
    const savedAt = new Date().toISOString();
    const photosForApi: Photo[] = photos.map(({ annotationPaths, ...photo }) => ({
      ...photo,
      timestamp: photo.timestamp || savedAt,
      ...(annotationPaths && annotationPaths.length > 0 ? { annotationPaths } : {}),
    }));
    const payload = {
      siteId: existingEntry?.siteId ?? siteId,
      date,
      weather,
      locationAddress: locationAddress.trim(),
      crewCount,
      notes: notes.trim(),
      photos: photosForApi,
      timeCode: timeCode.trim(),
      hoursWorked: hoursWorked.trim(),
    };
    try {
      if (isEditing && entryId) {
        await updateEntry(entryId, payload);
      } else {
        await addEntry(payload);
      }
      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save entry.";
      Alert.alert("Save Failed", message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!!site && (
          <View style={styles.siteHeader}>
            <View style={styles.siteHeaderIcon}>
              <Ionicons name="business" size={18} color={Colors.accent} />
            </View>
            <View style={styles.siteHeaderText}>
              <Text style={styles.siteHeaderName} numberOfLines={1}>{site.name}</Text>
              <Text style={styles.siteHeaderClient} numberOfLines={1}>{site.client}</Text>
            </View>
            {!isEditing && templates.length > 0 && (
              <Pressable style={styles.templateBtn} onPress={() => setShowTemplatePicker(true)}>
                <Ionicons name="copy-outline" size={14} color={Colors.accent} />
                <Text style={styles.templateBtnText}>Template</Text>
              </Pressable>
            )}
          </View>
        )}

        <View style={styles.formGroup}>
          <Text style={styles.label}>Date</Text>
          <Pressable style={styles.dateRow} onPress={openDatePicker}>
            <View style={styles.dateIconWrap}>
              <Ionicons name="calendar-outline" size={18} color={Colors.accent} />
            </View>
            <View style={styles.dateTextWrap}>
              <Text style={styles.dateValue}>{formattedDate}</Text>
              <Text style={styles.dateHint}>Tap to change</Text>
            </View>
          </Pressable>
          {showDatePicker && Platform.OS !== "ios" && (
            <DateTimePicker
              value={new Date(`${date}T00:00:00`)}
              mode="date"
              display="default"
              onChange={handleDateChange}
            />
          )}
          {showDatePicker && Platform.OS === "ios" && (
            <Modal visible transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
              <View style={styles.modalBackdrop}>
                <View style={styles.modalCard}>
                  <Text style={styles.modalTitle}>Set Entry Date</Text>
                  <Text style={styles.modalSelectedDate}>{formattedDraftDate}</Text>
                  <DateTimePicker
                    value={dateDraft}
                    mode="date"
                    display="spinner"
                    themeVariant="light"
                    textColor={Colors.text}
                    style={styles.modalDatePicker}
                    onChange={handleDateChange}
                  />
                  <View style={styles.modalActions}>
                    <Pressable style={styles.modalSecondary} onPress={() => setShowDatePicker(false)}>
                      <Text style={styles.modalSecondaryText}>Cancel</Text>
                    </Pressable>
                    <Pressable style={styles.modalPrimary} onPress={applyDateDraft}>
                      <Ionicons name="checkmark" size={18} color={Colors.white} />
                      <Text style={styles.modalPrimaryText}>Set Date</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </Modal>
          )}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Address / Location</Text>
          <TextInput
            style={styles.input}
            placeholder="Type location to search in Google Maps"
            placeholderTextColor={Colors.textTertiary}
            value={locationAddress}
            onChangeText={setLocationAddress}
          />
          {addressLoading && <Text style={styles.addressLoadingText}>Searching addresses...</Text>}
          {addressSuggestions.length > 0 && (
            <View style={styles.suggestionsCard}>
              {addressSuggestions.map((item) => (
                <Pressable
                  key={`${item.displayName}-${item.lat ?? ""}-${item.lon ?? ""}`}
                  style={styles.suggestionRow}
                  onPress={() => {
                    setLocationAddress(item.displayName);
                    setAddressSuggestions([]);
                  }}
                >
                  <Ionicons name="location-outline" size={16} color={Colors.textSecondary} />
                  <Text numberOfLines={2} style={styles.suggestionText}>
                    {item.displayName}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={styles.formGroup}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={styles.label}>Weather</Text>
            <Pressable
              onPress={autoFillWeather}
              disabled={weatherLoading}
              style={{ flexDirection: "row", alignItems: "center", gap: 4, opacity: weatherLoading ? 0.5 : 1 }}
            >
              {weatherLoading
                ? <ActivityIndicator size="small" color={Colors.primary} />
                : <Ionicons name="location-outline" size={14} color={Colors.primary} />}
              <Text style={{ fontSize: 13, color: Colors.primary }}>Auto-fill</Text>
            </Pressable>
          </View>
          <View style={styles.chipRow}>
            {weatherOptions.map((w) => (
              <Pressable
                key={w}
                style={[styles.chip, weather === w && styles.chipActive]}
                onPress={() => setWeather(weather === w ? "" : w)}
              >
                <Text style={[styles.chipText, weather === w && styles.chipTextActive]}>{w}</Text>
              </Pressable>
            ))}
          </View>
          {weather && !weatherOptions.includes(weather) && (
            <Text style={{ marginTop: 6, fontSize: 13, color: Colors.textSecondary }}>{weather}</Text>
          )}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Crew Count</Text>
          <TextInput
            style={styles.input}
            placeholder="Number of workers on site"
            placeholderTextColor={Colors.textTertiary}
            value={crewCount}
            onChangeText={setCrewCount}
            keyboardType="number-pad"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Time Code</Text>
          <View style={styles.chipRow}>
            {TIME_CODE_OPTIONS.map((tc) => (
              <Pressable
                key={tc}
                style={[styles.chip, timeCode === tc && styles.chipActive]}
                onPress={() => setTimeCode(timeCode === tc ? "" : tc)}
              >
                <Text style={[styles.chipText, timeCode === tc && styles.chipTextActive]}>{tc}</Text>
              </Pressable>
            ))}
          </View>
          {timeCode && !TIME_CODE_OPTIONS.includes(timeCode) && (
            <Text style={{ marginTop: 6, fontSize: 13, color: Colors.textSecondary }}>{timeCode}</Text>
          )}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Hours Worked</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 8"
            placeholderTextColor={Colors.textTertiary}
            value={hoursWorked}
            onChangeText={setHoursWorked}
            keyboardType="decimal-pad"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Photos ({photos.length})</Text>

          {photos.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.photoScroll}
              contentContainerStyle={styles.photoScrollContent}
            >
              {photos.map((photo) => (
                <View key={photo.id} style={styles.photoThumb}>
                  <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                  {photo.annotationPaths && photo.annotationPaths.length > 0 && (
                    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
                      {photo.annotationPaths.map((p, i) => (
                        <SvgPath
                          key={i}
                          d={p.d}
                          stroke={p.color}
                          strokeWidth={p.width}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                        />
                      ))}
                    </Svg>
                  )}
                  <Pressable
                    style={styles.photoRemove}
                    onPress={() => removePhoto(photo.id)}
                  >
                    <Ionicons name="close" size={14} color={Colors.white} />
                  </Pressable>
                  <Pressable
                    style={styles.photoDraw}
                    onPress={() =>
                      router.push({
                        pathname: "/draw-photo",
                        params: { uri: encodeURIComponent(photo.uri), photoId: photo.id },
                      })
                    }
                  >
                    <Ionicons name="pencil" size={12} color={Colors.white} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}

          <View style={styles.photoActions}>
            <Pressable
              style={[styles.photoButton, pickingPhoto && styles.photoButtonDisabled]}
              onPress={handleTakePhoto}
              disabled={pickingPhoto}
            >
              {pickingPhoto ? (
                <ActivityIndicator size="small" color={Colors.accent} />
              ) : (
                <Ionicons name="camera" size={22} color={Colors.accent} />
              )}
              <Text style={styles.photoButtonText}>Camera</Text>
            </Pressable>

            <Pressable
              style={[styles.photoButton, pickingPhoto && styles.photoButtonDisabled]}
              onPress={handlePickFromGallery}
              disabled={pickingPhoto}
            >
              <Ionicons name="images" size={22} color={Colors.accent} />
              <Text style={styles.photoButtonText}>Gallery</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Notes & Observations</Text>
          <TextInput
            style={[styles.textArea, !!errors.notes && styles.inputError]}
            placeholder="Describe today's work, progress, issues, safety observations..."
            placeholderTextColor={Colors.textTertiary}
            value={notes}
            onChangeText={(t) => { setNotes(t); setErrors((e) => ({ ...e, notes: "" })); }}
            multiline
            textAlignVertical="top"
          />
          {!!errors.notes && <Text style={styles.errorText}>{errors.notes}</Text>}
        </View>

        <Pressable
          style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed]}
          onPress={handleSave}
        >
          <Ionicons name="checkmark" size={22} color={Colors.white} />
          <Text style={styles.saveButtonText}>{isEditing ? "Save Changes" : "Save Entry"}</Text>
        </Pressable>
      </ScrollView>

      {/* Template Picker Modal */}
      <Modal visible={showTemplatePicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowTemplatePicker(false)}>
        <View style={{ flex: 1, backgroundColor: "#fff", paddingTop: 32 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#E8EDF5" }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: Colors.text }}>Use Template</Text>
            <Pressable onPress={() => setShowTemplatePicker(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
            {templates.map((tpl) => (
              <Pressable key={tpl.id} style={{ backgroundColor: "#F8FAFB", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border }} onPress={() => applyTemplate(tpl)}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.text }}>{tpl.name}</Text>
                {tpl.weather ? <Text style={{ fontSize: 13, color: Colors.textSecondary, marginTop: 2 }}>Weather: {tpl.weather}</Text> : null}
                {tpl.crewCount ? <Text style={{ fontSize: 13, color: Colors.textSecondary }}>Crew: {tpl.crewCount}</Text> : null}
                {tpl.notes ? <Text style={{ fontSize: 13, color: Colors.textTertiary, marginTop: 4 }} numberOfLines={2}>{tpl.notes}</Text> : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
    gap: 20,
    paddingBottom: 40,
  },
  formGroup: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginLeft: 4,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    height: 52,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
  },
  inputError: {
    borderColor: Colors.error,
  },
  errorText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.error,
    marginLeft: 4,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  dateIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${Colors.accent}14`,
  },
  dateTextWrap: {
    flex: 1,
  },
  dateValue: {
    fontSize: 18,
    fontFamily: Platform.OS === "ios" ? "System" : "Inter_700Bold",
    fontWeight: Platform.OS === "ios" ? "700" : undefined,
    color: Colors.text,
  },
  dateHint: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  addressLoadingText: {
    marginTop: 6,
    marginLeft: 4,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  suggestionsCard: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    overflow: "hidden",
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  suggestionText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.white,
  },
  photoScroll: {
    marginTop: 4,
  },
  photoScrollContent: {
    gap: 10,
    paddingRight: 4,
  },
  photoThumb: {
    width: 88,
    height: 88,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  photoImage: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
  photoRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoDraw: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  photoButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: "dashed",
    paddingVertical: 18,
  },
  photoButtonDisabled: {
    opacity: 0.5,
  },
  photoButtonText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,43,70,0.36)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    width: "100%",
    borderRadius: 16,
    backgroundColor: Colors.surface,
    padding: 14,
    gap: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 4,
  },
  modalSelectedDate: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    textAlign: "center",
    marginTop: 2,
  },
  modalDatePicker: {
    backgroundColor: Colors.surface,
    height: 180,
  },
  modalSecondary: {
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  modalSecondaryText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  modalPrimary: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.accent,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  modalPrimaryText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
  },
  siteHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  siteHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.accent + "14",
    alignItems: "center",
    justifyContent: "center",
  },
  siteHeaderText: {
    flex: 1,
  },
  siteHeaderName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  siteHeaderClient: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    marginTop: 1,
  },
  templateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.accent + "14",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  templateBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.accent,
  },
  textArea: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    minHeight: 140,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    lineHeight: 22,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.accent,
    height: 54,
    borderRadius: 14,
    marginTop: 8,
  },
  saveButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  saveButtonText: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
  },
});
